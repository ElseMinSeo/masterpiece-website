-- 리뷰 반영 (2026-11-28)
-- 1) 기간이 끝났거나 아직 시작 전인 회차는 status가 open이어도 접수하지 않는다.
-- 2) 가능 일정은 맞는 날짜×시간대 조합만 저장한다. ('토요일 평일 저녁' 같은 조합을 만들지 않음)
--    서버(Zod)가 먼저 막지만, DB도 같은 규칙을 지킨다.

create or replace function public.submit_application(p_user_id uuid, p_idempotency_key text, p_payload jsonb)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := p_user_id;
  v_cohort uuid;
  v_app public.applications;
  v_date text;
  v_slot text;
  v_start int;
  v_end int;
  v_tries int := 0;
  v_pairs int := 0;
begin
  if v_uid is null then
    raise exception 'user required' using errcode = '42501';
  end if;

  select * into v_app from public.applications where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return v_app; end if;

  select id into v_cohort from public.cohorts
    where status = 'open' and start_at <= now() and end_at > now()
    order by start_at desc limit 1;
  if v_cohort is null then
    raise exception 'no open cohort' using errcode = 'P0002';
  end if;

  select * into v_app from public.applications
    where user_id = v_uid and cohort_id = v_cohort and status in ('submitted', 'reviewing', 'offered');
  if found then return v_app; end if;

  loop
    begin
      insert into public.applications (number, user_id, cohort_id, idempotency_key, birth_year, gender, smoking,
        stations, budget_min, budget_max, age_min, age_max, answers)
      values (
        'CG-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)),
        v_uid, v_cohort, p_idempotency_key,
        (p_payload ->> 'birthYear')::int, p_payload ->> 'gender', p_payload ->> 'smoking',
        array(select jsonb_array_elements_text(p_payload -> 'stations')),
        (p_payload ->> 'budgetMin')::int, (p_payload ->> 'budgetMax')::int,
        (p_payload ->> 'ageMin')::int, (p_payload ->> 'ageMax')::int,
        p_payload)
      returning * into v_app;
      exit;
    exception when unique_violation then
      -- 동시에 들어온 같은 요청이 먼저 만들었으면 그 신청을 돌려준다
      select * into v_app from public.applications where user_id = v_uid and idempotency_key = p_idempotency_key;
      if found then return v_app; end if;
      select * into v_app from public.applications
        where user_id = v_uid and cohort_id = v_cohort and status in ('submitted', 'reviewing', 'offered');
      if found then return v_app; end if;
      v_tries := v_tries + 1; -- 신청 번호가 겹친 경우 다시 시도
      if v_tries > 5 then raise; end if;
    end;
  end loop;

  if jsonb_array_length(coalesce(p_payload -> 'dates', '[]')) not between 1 and 6
     or jsonb_array_length(coalesce(p_payload -> 'timeSlots', '[]')) not between 1 and 2 then
    raise exception 'invalid availability' using errcode = '22023';
  end if;

  for v_date in select jsonb_array_elements_text(p_payload -> 'dates') loop
    for v_slot in select jsonb_array_elements_text(p_payload -> 'timeSlots') loop
      select start_h, end_h into v_start, v_end from public.slot_hours(v_slot);
      if v_start is null then
        raise exception 'unknown time slot %', v_slot using errcode = '22023';
      end if;
      -- 평일 저녁은 월~금, 주말 시간대는 토·일 날짜에만 저장한다 (isodow: 6=토, 7=일)
      continue when (v_slot like 'weekend-%') <> (extract(isodow from v_date::date) >= 6);
      v_pairs := v_pairs + 1;
      insert into public.availability (application_id, slot_date, slot_id, starts_at, ends_at)
      values (v_app.id, v_date::date, v_slot,
        (v_date::date + make_time(v_start, 0, 0)) at time zone 'Asia/Seoul',
        (v_date::date + make_time(v_end, 0, 0)) at time zone 'Asia/Seoul');
    end loop;
  end loop;

  if v_pairs = 0 then
    raise exception 'no matching date and time slot' using errcode = '22023';
  end if;

  delete from public.application_drafts where user_id = v_uid;
  return v_app;
end;
$$;
revoke all on function public.submit_application(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_application(uuid, text, jsonb) to service_role;

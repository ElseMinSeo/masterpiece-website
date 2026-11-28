-- 단계 2: 신청 초안, 신청, 가능 일정, 제출 함수, 운영자 소개 대상 조회
-- 신청은 서버 경로(/api/applications)가 Zod로 검증한 뒤 submit_application 함수로만 만든다.

create table public.application_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (pg_column_size(data) < 64000)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'offered', 'closed', 'withdrawn')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  birth_year integer not null check (birth_year between 1900 and 2100),
  gender text not null check (gender in ('남성', '여성')),
  smoking text not null check (smoking in ('흡연', '비흡연')),
  stations text[] not null check (cardinality(stations) between 1 and 2),
  budget_min integer not null check (budget_min >= 0),
  budget_max integer not null check (budget_max <= 200000),
  age_min integer not null check (age_min >= 20),
  age_max integer not null check (age_max <= 45),
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (user_id, idempotency_key),
  check (budget_min <= budget_max),
  check (age_min <= age_max)
);
-- 회차별 진행 중 신청은 사용자당 1건
create unique index applications_one_active_per_cohort on public.applications (user_id, cohort_id)
  where status in ('submitted', 'reviewing', 'offered');
create index applications_cohort_status_idx on public.applications (cohort_id, status);

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  slot_date date not null,
  slot_id text not null check (slot_id in ('weekday-evening', 'weekend-lunch', 'weekend-afternoon', 'weekend-evening')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  unique (application_id, slot_date, slot_id),
  check (ends_at > starts_at)
);

alter table public.application_drafts enable row level security;
alter table public.applications enable row level security;
alter table public.availability enable row level security;

revoke all on public.application_drafts, public.applications, public.availability from anon, authenticated;
grant select, insert, update, delete on public.application_drafts to authenticated;
grant select on public.applications, public.availability to authenticated;

create policy "drafts: 본인만" on public.application_drafts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "applications: 본인 또는 운영자 조회" on public.applications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "availability: 본인 또는 운영자 조회" on public.availability for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and (a.user_id = (select auth.uid()) or (select public.is_admin()))
  ));

create trigger application_drafts_touch before update on public.application_drafts
  for each row execute function public.touch_updated_at();
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();

-- 시간대 → 서울 시각
create function public.slot_hours(p_slot text, out start_h int, out end_h int)
language sql immutable set search_path = ''
as $$
  select s.a, s.b from (values
    ('weekday-evening', 19, 21), ('weekend-lunch', 12, 14),
    ('weekend-afternoon', 15, 17), ('weekend-evening', 18, 20)
  ) as s(id, a, b) where s.id = p_slot;
$$;

create function public.submit_application(p_idempotency_key text, p_payload jsonb)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cohort uuid;
  v_app public.applications;
  v_date text;
  v_slot text;
  v_start int;
  v_end int;
  v_tries int := 0;
begin
  if v_uid is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  select * into v_app from public.applications where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return v_app; end if;

  select id into v_cohort from public.cohorts where status = 'open' order by start_at desc limit 1;
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
      insert into public.availability (application_id, slot_date, slot_id, starts_at, ends_at)
      values (v_app.id, v_date::date, v_slot,
        (v_date::date + make_time(v_start, 0, 0)) at time zone 'Asia/Seoul',
        (v_date::date + make_time(v_end, 0, 0)) at time zone 'Asia/Seoul');
    end loop;
  end loop;

  delete from public.application_drafts where user_id = v_uid;
  return v_app;
end;
$$;
revoke all on function public.submit_application(text, jsonb) from public, anon;
grant execute on function public.submit_application(text, jsonb) to authenticated;

-- 운영자: 본인확인을 마친 사람의 진행 중 신청만 소개 대상으로 돌려준다
create function public.introducible_applications(p_cohort uuid)
returns setof public.applications
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'operator only' using errcode = '42501';
  end if;
  return query
    select a.* from public.applications a
    join public.private_profiles pp on pp.user_id = a.user_id
    join public.profiles p on p.id = a.user_id
    where a.cohort_id = p_cohort
      and a.status in ('submitted', 'reviewing')
      and pp.verification_status = 'verified'
      and p.account_status = 'active';
end;
$$;
revoke all on function public.introducible_applications(uuid) from public, anon;
grant execute on function public.introducible_applications(uuid) to authenticated;

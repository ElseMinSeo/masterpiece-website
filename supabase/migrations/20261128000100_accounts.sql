-- 단계 2: 계정 (프로필, 비공개 프로필, 동의, 운영자 권한)
-- 원칙: 모든 테이블 RLS 기본 거부. 사용자는 본인 것만, 운영자 권한은 서버(service role/SQL)만 부여.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '새 사용자' check (char_length(btrim(nickname)) between 1 and 12),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 본인확인 상태는 로그인과 분리. 자기 신고값으로는 바꿀 수 없고 서버만 갱신한다.
create table public.private_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  verified_at timestamptz,
  verified_birth_date date,
  provider_ref text,
  updated_at timestamptz not null default now(),
  check (verification_status <> 'verified' or verified_at is not null)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('terms', 'privacy', 'marketing')),
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_user_idx on public.consents (user_id, purpose);

create table public.admin_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('operator')),
  created_at timestamptz not null default now()
);

-- 운영자 여부. RLS 안에서 admin_roles를 직접 읽지 않도록 security definer로 감싼다.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- 가입 시 프로필 행을 자동으로 만든다
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.private_profiles (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger private_profiles_touch before update on public.private_profiles
  for each row execute function public.touch_updated_at();

-- 접근 규칙
alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.consents enable row level security;
alter table public.admin_roles enable row level security;

revoke all on public.profiles, public.private_profiles, public.consents, public.admin_roles from anon, authenticated;
grant select on public.profiles, public.private_profiles, public.consents to authenticated;
grant update (nickname) on public.profiles to authenticated;
grant insert (user_id, purpose, policy_version) on public.consents to authenticated;
grant update (revoked_at) on public.consents to authenticated;

create policy "profiles: 본인 또는 운영자 조회" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: 본인 닉네임 수정" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "private_profiles: 본인 또는 운영자 조회" on public.private_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "consents: 본인 조회" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "consents: 본인 기록" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "consents: 본인 철회" on public.consents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- admin_roles: 정책 없음 = 사용자 접근 불가

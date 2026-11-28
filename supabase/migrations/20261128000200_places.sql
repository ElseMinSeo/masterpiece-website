-- 단계 2: 장소, 저장, 회차

create table public.places (
  id text primary key check (char_length(id) between 1 and 40),
  name text not null,
  category text not null check (category in ('restaurant', 'cafe', 'fine', 'bar', 'mood')),
  cuisine text not null check (cuisine in ('korean', 'western', 'japanese', 'chinese', 'etc')),
  district text not null,
  station text not null,
  address text not null,
  price_min integer not null check (price_min >= 0),
  price_max integer not null,
  noise_level text not null check (noise_level in ('quiet', 'moderate', 'lively')),
  seating text not null,
  hours_text text not null,
  checked_at date not null,
  source_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (price_min <= price_max)
);
create index places_browse_idx on public.places (published, category, district);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  region text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

alter table public.places enable row level security;
alter table public.bookmarks enable row level security;
alter table public.cohorts enable row level security;

revoke all on public.places, public.bookmarks, public.cohorts from anon, authenticated;
grant select on public.places to anon, authenticated;
grant select on public.cohorts to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;

create policy "places: 공개된 장소만" on public.places for select to anon, authenticated
  using (published or (select public.is_admin()));
create policy "cohorts: 로그인 사용자 조회" on public.cohorts for select to authenticated using (true);
create policy "bookmarks: 본인 조회" on public.bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "bookmarks: 본인 저장" on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "bookmarks: 본인 삭제" on public.bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

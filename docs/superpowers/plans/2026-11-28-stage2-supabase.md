# 단계 2: 계정과 데이터 (로컬 Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저 localStorage 데모를 로그인 사용자별 Supabase 데이터로 바꿀 수 있게 하고, 두 계정이 서로의 비공개 데이터를 볼 수 없음을 자동 테스트로 증명한다.

**Architecture:** 로컬 Supabase(Postgres·Auth·Storage, Docker)를 쓴다. 스키마와 접근 규칙(RLS)은 `supabase/migrations/`의 SQL로 관리한다. 화면은 지금처럼 `AppRepository`만 사용하고, `NEXT_PUBLIC_DATA_SOURCE=supabase`일 때 `SupabaseRepository`로 바뀐다. 기본값은 `local-demo`라서 Vercel 공개 데모는 그대로 동작한다. 신청 제출은 서버 경로(`POST /api/applications`)에서 Zod로 다시 검증한 뒤, 사용자 세션으로 DB 함수 `submit_application`을 호출한다. 따라서 RLS와 DB 제약이 마지막 방어선이 된다.

**Tech Stack:** Next.js 16 App Router(`proxy.ts`), `@supabase/supabase-js` 2.119.x, `@supabase/ssr` 0.12.x, Supabase CLI 3.4.0(devDependency), Postgres 17, Vitest, Playwright.

**Spec:** `START.md` "2. 계정과 데이터", `ROADMAP.md` §5(DB 초안·접근 제어·상태 전이), §8(T02·T03·T04), §9 Prompt 2. 원본은 사용자가 제공한 압축 파일에 있다. 필요한 내용은 아래 Global Constraints에 옮겨 적었다.

## Global Constraints

- 로컬 Supabase만 쓴다. 운영 DB 변경 금지. 실제 비밀키를 커밋하지 않고 `.env.example`만 작성한다.
- 이미지 받기: 이 환경에서는 `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`가 필요하다(public.ecr.aws는 데이터 한도로 막힘). `npm run db:start`에 넣는다.
- 로그인: 이메일 OTP(6자리). 로컬 메일은 Mailpit `http://127.0.0.1:54324`에서 확인한다.
- 성인·본인확인 상태는 로그인과 분리한다. `verification_status`: `unverified | pending | verified`. 자기 신고(출생 연도)만으로 `verified` 표시 금지. 운영(production)에서는 mock 확인이 동작하지 않는다.
- 사용자 A는 B의 비공개 신청·초안·비공개 프로필·동의·저장·사진을 조회·수정할 수 없다(T03). 모든 테이블 RLS 기본 거부.
- 운영자 권한(`admin_roles`)은 서버(service role/SQL)만 부여한다. 사용자는 수정 불가.
- 미인증자는 소개 대상에서 제외한다: 운영자용 조회 함수가 `verified`만 돌려준다.
- 회차별 활성 신청(`submitted|reviewing|offered`)은 사용자당 1건. 같은 `idempotency_key` 재요청은 기존 신청을 돌려준다(T04).
- 테스트 로그인은 개발 환경에서만 동작한다: `DEV_TEST_LOGIN=1` **그리고** Supabase URL 호스트가 `127.0.0.1` 또는 `localhost`일 때만. 아니면 404.
- 시간은 UTC로 저장하고, 날짜·시간대 변환은 Asia/Seoul 기준으로 한다. 금액은 KRW 정수.
- 기존 `local-demo` 모드의 단위 27개·E2E 7개 테스트는 계속 통과해야 한다.
- 커밋 전 `npm run typecheck`, `npm test`, `npm run build && npm run test:e2e`, 그리고 DB를 바꿨으면 `npm run test:db`.

## Review Focus

1. **동시 제출:** 같은 사용자가 같은 키로 3번 동시에 제출해도 1건만 생기고, 다른 키로 동시에 제출해도 활성 신청은 1건이어야 한다 → Task 4 테스트.
2. **로그인 안 한 사용자:** supabase 모드에서 로그인 없이 `/apply`, `/appointments`에 들어오면 깨지지 않고 `/login?next=...`로 보내야 한다. 장소 둘러보기는 그대로 된다 → Task 6 E2E.
3. **RLS 우회 시도:** A가 `user_id`를 B로 바꿔 insert/update하거나, 자기 `verification_status`·`admin_roles`를 직접 바꾸려 하면 거부돼야 한다 → Task 2·4 테스트.
4. **예전 localStorage 초안:** supabase 모드로 바꿔도 기존 데모 데이터와 섞이지 않아야 한다(서버 초안만 사용) → Task 7 테스트.
5. **OTP 오류·만료:** 틀린 코드를 넣으면 필드에 오류가 나오고 다시 요청할 수 있어야 한다 → Task 6 E2E.

## 설계 결정 (계획에서 정함)

- **초안 저장:** `application_drafts(user_id PK, data jsonb)` 별도 테이블. ROADMAP의 `applications.status='draft'` 대신이다. 이유: 미완성 초안은 형식 검증을 할 수 없어 제출 신청과 제약이 다르다.
- **신청 저장:** 운영자가 조건으로 찾을 값은 컬럼에 둔다(`cohort_id, status, stations text[], budget_min/max, birth_year, gender, smoking, age_min/max`). 나머지 답변은 `answers jsonb`(검증된 `SubmittedApplication` 전체)에 넣는다.
- **가능 일정:** `availability(application_id, slot_date date, slot_id text, starts_at, ends_at)`. 날짜×시간대 조합마다 한 줄이다. 역은 신청의 `stations`에 둔다.
- **장소:** `places` 테이블을 만들고 `lib/data/places.ts`에서 생성한 `supabase/seed.sql`로 채운다. 화면은 이번 단계에서 코드 데이터를 계속 읽는다(같은 id). DB 읽기 전환은 운영 장소 등록 때 한다.
- **회차:** seed로 `pilot-1`(open) 1개를 둔다. 제출 시 열려 있는 최신 회차를 쓴다.
- **사진:** private 버킷 `profile-photos`. 경로는 `{user_id}/...`, 본인만 읽고 쓴다. 업로드 UI는 이번 범위가 아니다.

---

### Task 1: Supabase 기반 설정

**Files:**
- Create: `supabase/config.jsonc`(이미 `supabase init`으로 생성됨, 그대로 커밋), `lib/env.ts`, `vitest.db.config.mts`, `tests/db/helpers.ts`, `tests/db/smoke.test.ts`
- Modify: `package.json`(scripts·deps), `.env.example`, `.gitignore`(`supabase/.temp/`, `supabase/.branches/`)

**Interfaces:**
- Produces: `dataSource(): "local-demo" | "supabase"`, `supabasePublicEnv(): { url: string; anonKey: string }`(없으면 throw), `isLocalSupabaseUrl(url: string): boolean` in `lib/env.ts`
- Produces: `tests/db/helpers.ts` — `admin()`(service role client), `makeUser(tag: string): Promise<{ id: string; email: string; client: SupabaseClient }>`(admin.createUser로 비밀번호 사용자 생성 후 anon 클라이언트로 로그인)
- Scripts: `db:start`(`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta`), `db:stop`, `db:reset`(`supabase db reset`), `test:db`(`vitest run -c vitest.db.config.mts`), `db:seed:gen`(Task 3)

- [ ] **Step 1:** `tests/unit/env.test.ts` — `isLocalSupabaseUrl("http://127.0.0.1:54321") === true`, `("http://localhost:54321") === true`, `("https://abc.supabase.co") === false`, `dataSource()`가 env 미설정 시 `"local-demo"`.
- [ ] **Step 2:** 실행해 실패 확인: `npx vitest run tests/unit/env.test.ts` → FAIL(module not found)
- [ ] **Step 3:** `lib/env.ts` 구현. deps 설치: `@supabase/supabase-js@2.119.2`, `@supabase/ssr@0.12.7`.
- [ ] **Step 4:** `tests/db/smoke.test.ts` — `makeUser("a")`가 세션을 가진 클라이언트를 돌려준다. DB 테스트 env는 `vitest.db.config.mts`에서 로컬 기본 키(`supabase status -o env`의 값)로 채운다.
- [ ] **Step 5:** `npm run db:start && npm run test:db` → PASS, `npm test` → 기존 27개 + env PASS
- [ ] **Step 6:** Commit `단계 2 기반: 로컬 Supabase 설정과 DB 테스트 환경`

### Task 2: 계정 스키마와 RLS

**Files:**
- Create: `supabase/migrations/20261128000100_accounts.sql`, `tests/db/accounts.test.ts`

**Interfaces:**
- Produces 테이블:
  - `profiles(id uuid PK FK auth.users on delete cascade, nickname text check 1..12자, account_status text check in ('active','suspended','deleted') default 'active', deleted_at, created_at, updated_at)`
  - `private_profiles(user_id PK FK, verification_status text check in ('unverified','pending','verified') default 'unverified', verified_at, verified_birth_date date, provider_ref text, updated_at)`
  - `consents(id uuid, user_id, purpose text check in ('terms','privacy','marketing'), policy_version text, granted_at, revoked_at)`
  - `admin_roles(user_id PK, role text check in ('operator'))`
- Produces 함수: `public.is_admin() returns boolean`(security definer, `search_path=''`). `auth.users` insert 트리거 `handle_new_user()`가 profiles(nickname='새 사용자')와 private_profiles를 만든다.
- RLS:
  - profiles: 본인 select/update(nickname만 바꿀 수 있게 컬럼 권한 `grant update(nickname)`)
  - private_profiles: 본인 select만. update/insert 권한 없음(서버만)
  - consents: 본인 select/insert, `revoked_at`만 본인 update
  - admin_roles: 권한 없음
  - 운영자(is_admin)는 profiles·private_profiles select

- [ ] **Step 1:** 실패 테스트 작성 `tests/db/accounts.test.ts`:
  - 가입 시 profiles·private_profiles 자동 생성, `verification_status === "unverified"`
  - A는 B의 profiles·private_profiles·consents를 0행으로 받는다
  - A가 자기 `private_profiles.verification_status='verified'` update → 0행 갱신(또는 오류), 다시 읽으면 `unverified`
  - A가 `admin_roles` insert → 오류
  - A가 `consents`에 `user_id=B`로 insert → 오류
  - 운영자(service role로 admin_roles 추가된 C)는 A·B profiles를 읽는다
- [ ] **Step 2:** `npm run test:db -- accounts` → FAIL(relation does not exist)
- [ ] **Step 3:** 마이그레이션 작성 → `npm run db:reset`
- [ ] **Step 4:** `npm run test:db` → PASS
- [ ] **Step 5:** Commit `계정 테이블과 접근 규칙(RLS)`

### Task 3: 장소·저장 스키마

**Files:**
- Create: `supabase/migrations/20261128000200_places.sql`, `scripts/gen-seed.ts`, `supabase/seed.sql`(생성물, 커밋), `tests/db/places.test.ts`, `tests/unit/seed.test.ts`

**Interfaces:**
- Produces: `places(id text PK, name, category, cuisine, district, station, address, price_min int, price_max int check(price_min<=price_max), noise_level, seating, hours_text, checked_at date, published boolean default false, created_at)`, `bookmarks(user_id, place_id FK places, created_at, PK(user_id, place_id))`, `cohorts(id uuid, code text unique, region, start_at, end_at, status check in ('open','closed'))`
- RLS: places는 `published=true`만 누구나(anon 포함) select. bookmarks는 본인 select/insert/delete.
- Produces: `scripts/gen-seed.ts`(`npm run db:seed:gen`)가 `DEV_PLACES`를 published=true로 넣는 SQL과 `pilot-1` 회차(open, 오늘~+56일)를 `supabase/seed.sql`에 쓴다. `buildSeedSql(places: Place[]): string`을 export한다.

- [ ] **Step 1:** `tests/unit/seed.test.ts` — `buildSeedSql(DEV_PLACES)`에 8개 id가 모두 들어가고, `'`가 들어간 이름도 이스케이프된다(`O'Neil` → `O''Neil`).
- [ ] **Step 2:** `tests/db/places.test.ts` — anon이 places 8행을 읽음. A가 dev-001 저장, B는 A의 bookmarks 0행. A가 `user_id=B`로 insert → 오류. 없는 place_id → FK 오류.
- [ ] **Step 3:** 실패 확인 → 구현 → `npm run db:seed:gen && npm run db:reset` → `npm test && npm run test:db` PASS
- [ ] **Step 4:** Commit `장소·저장·회차 테이블과 개발용 seed`

### Task 4: 신청·초안·가능 일정 + 제출 함수

**Files:**
- Create: `supabase/migrations/20261128000300_applications.sql`, `tests/db/applications.test.ts`

**Interfaces:**
- Produces 테이블:
  - `application_drafts(user_id PK FK, data jsonb not null, updated_at)`: 본인 select/insert/update/delete
  - `applications(id uuid, number text unique, user_id, cohort_id FK, status check in ('submitted','reviewing','offered','closed','withdrawn'), idempotency_key text, birth_year int, gender text, smoking text, stations text[] check(cardinality between 1 and 2), budget_min int, budget_max int check(budget_min<=budget_max), age_min int, age_max int check(age_min<=age_max and age_min>=20), answers jsonb, submitted_at, updated_at, version int default 1, unique(user_id, idempotency_key))`
  - 부분 유일 인덱스 `one_active_per_cohort on applications(user_id, cohort_id) where status in ('submitted','reviewing','offered')`. 인덱스 `(cohort_id, status)`.
  - `availability(id, application_id FK cascade, slot_date date, slot_id text, starts_at timestamptz, ends_at timestamptz check(ends_at>starts_at))`
- RLS: applications·availability는 본인 select만. insert/update는 함수로만. 운영자는 select.
- Produces 함수 `public.submit_application(p_idempotency_key text, p_payload jsonb) returns applications`(security definer, `search_path=''`, `auth.uid()` 필수):
  1. 같은 (uid, key) 신청이 있으면 그대로 반환
  2. 열린 회차의 활성 신청이 있으면 그대로 반환
  3. 없으면 신청 번호 `CG-YYMMDD-XXXX`(Asia/Seoul)를 만들어 insert하고, availability를 날짜×시간대로 insert하고, 초안을 지운다. 유일 위반(동시 요청)은 잡아서 기존 행을 반환한다.
  - 시간대→시각 매핑(KST): `weekday-evening` 19–21, `weekend-lunch` 12–14, `weekend-afternoon` 15–17, `weekend-evening` 18–20
- Produces 함수 `public.introducible_applications(p_cohort uuid) returns setof applications`: is_admin이 아니면 예외. `verification_status='verified'`이고 활성인 신청만 반환한다.

- [ ] **Step 1:** 실패 테스트:
  - A가 같은 키로 `Promise.all` 3회 → applications 1행, 세 결과 id 동일
  - A가 다른 키 2개로 동시 제출 → 활성 1행
  - availability 행 수 = 날짜 수 × 시간대 수, starts_at이 KST 19:00 = UTC 10:00
  - B는 A의 applications·availability·application_drafts 0행
  - A가 applications에 직접 insert/update → 오류
  - stations 3개, budget 역전 payload → 함수가 check 위반 오류
  - 운영자: A(unverified)·B(verified, service role로 설정) 신청 중 `introducible_applications`는 B만. A가 호출하면 오류
- [ ] **Step 2:** FAIL 확인 → 마이그레이션 구현 → `db:reset` → PASS
- [ ] **Step 3:** Commit `신청·초안·가능 일정 테이블과 제출 함수`

### Task 5: 사진 저장소(Storage) 정책

**Files:**
- Create: `supabase/migrations/20261128000400_storage.sql`, `tests/db/storage.test.ts`

**Interfaces:**
- Produces: private 버킷 `profile-photos`(5MB, image/jpeg·png·webp). storage.objects 정책: `bucket_id='profile-photos' and (storage.foldername(name))[1] = auth.uid()::text`일 때 본인 select/insert/update/delete.

- [ ] **Step 1:** 실패 테스트: A가 `A/1.png` 업로드 성공, B가 `A/1.png` 다운로드 → 오류, B가 `A/x.png` 업로드 → 오류, anon 공개 URL 접근 불가(private).
- [ ] **Step 2:** 구현 → `db:reset` → PASS
- [ ] **Step 3:** Commit `프로필 사진 저장소 접근 규칙`

### Task 6: 로그인·동의·세션 (화면 + 서버)

**Files:**
- Create: `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy-session.ts`, `proxy.ts`, `app/login/page.tsx`, `app/auth/signout/route.ts`, `app/onboarding/consent/page.tsx`, `app/api/dev/login/route.ts`, `lib/dev-login.ts`, `tests/unit/dev-login.test.ts`, `tests/e2e-supabase/auth.spec.ts`, `playwright.supabase.config.ts`
- Modify: `components/ui.tsx`(필요 시 로그인 안내 컴포넌트), `docs/` 없음

**Interfaces:**
- Consumes: `dataSource()`, `supabasePublicEnv()`, `isLocalSupabaseUrl()` (Task 1)
- Produces: `createBrowserSupabase(): SupabaseClient`, `createServerSupabase(): Promise<SupabaseClient>`(cookies 기반), `devLoginAllowed(env: { DEV_TEST_LOGIN?: string; url: string }): boolean`
- `proxy.ts`: supabase 모드에서만 세션 쿠키를 갱신한다. 비로그인으로 `/apply`, `/appointments`, `/saved`, `/profile`, `/onboarding`에 오면 `/login?next=<경로>`로 보낸다. 로그인했지만 terms·privacy 동의가 없으면 `/onboarding/consent?next=`로 보낸다. local-demo 모드에서는 아무것도 하지 않는다.
- `/login`: 이메일 입력 → `signInWithOtp` → 6자리 코드 입력 → `verifyOtp` → `next`로 이동. 오류 문구: "이메일 형식이 올바르지 않아요.", "코드가 맞지 않거나 만료됐어요. 다시 받아주세요.", 재전송 버튼(60초 대기 표시).
- `/onboarding/consent`: 필수 "서비스 이용약관 동의", "개인정보 수집·이용 동의"(policy_version `2026-11-draft`), 선택 "마케팅 정보 수신". 필수 2개 없이는 버튼 비활성 + 오류. 문구에 "약관 본문은 확정 전" 표시.
- `/api/dev/login`(POST `{email}`): `devLoginAllowed`가 false면 404. true면 admin으로 사용자를 만들거나 가져오고, `generateLink({type:'magiclink'})`의 `email_otp`로 서버에서 `verifyOtp`해 세션 쿠키를 설정하고, 동의 2건을 기록한다.

- [ ] **Step 1:** `tests/unit/dev-login.test.ts` — 플래그 없음→false, 플래그+`https://x.supabase.co`→false, 플래그+`http://127.0.0.1:54321`→true.
- [ ] **Step 2:** FAIL → `lib/dev-login.ts` 구현 → PASS
- [ ] **Step 3:** `tests/e2e-supabase/auth.spec.ts`(`playwright.supabase.config.ts`는 `next dev` 대신 `next build && next start`를 env `NEXT_PUBLIC_DATA_SOURCE=supabase DEV_TEST_LOGIN=1`로 띄운다. 포트 3200):
  - 비로그인 `/apply` → `/login?next=%2Fapply`
  - `/login`에서 이메일 입력 → Mailpit API(`GET :54324/api/v1/search?query=to:<email>`)에서 6자리 코드를 읽어 입력 → 동의 화면 → 필수 2개 체크 → `/apply/1` 도착
  - 틀린 코드 `000000` → 오류 문구 표시
  - `/places`는 비로그인으로 열린다
- [ ] **Step 4:** 구현 후 `npm run test:e2e:supabase` PASS, 기존 `npm run test:e2e` PASS
- [ ] **Step 5:** Commit `이메일 OTP 로그인, 동의 화면, 개발 전용 테스트 로그인`

### Task 7: SupabaseRepository와 서버 제출 경로

**Files:**
- Create: `lib/repo/supabase.ts`, `app/api/applications/route.ts`, `tests/db/repository.test.ts`
- Modify: `lib/repo/index.ts`(데이터 소스 분기), `lib/repo/types.ts`(`kind` 그대로 + `currentUser()` 추가), `lib/repo/local.ts`(`currentUser`가 데모 사용자 반환), `lib/store.tsx`(supabase 모드에서 저장 버튼을 비로그인 상태로 누르면 `/login?next=`로 이동), `app/profile/page.tsx`(본인확인 상태 배지, supabase 모드에서 데모 초기화 숨김, 로그아웃)

**Interfaces:**
- Produces: `AppRepository.currentUser(): Promise<{ id: string; email: string | null } | null>`
- Produces: `getVerificationStatus(): Promise<"unverified" | "pending" | "verified">`(SupabaseRepository 전용, profile 화면에서 사용. local-demo는 항상 `"unverified"`)
- `SupabaseRepository`(브라우저 클라이언트 사용):
  - profile → `profiles`
  - bookmarks → `bookmarks`
  - draft → `application_drafts`(saveDraft는 600ms 디바운스, `submitApplication` 직전 flush)
  - `listApplications` → `applications`를 기존 `Application` 타입(`number, status, submittedAt, idempotencyKey, data=answers`)으로 변환
  - `submitApplication` → `fetch("/api/applications", { method: "POST", body: JSON.stringify(draft) })`
- `POST /api/applications`: 세션 없으면 401. `parseSubmission(normalizeDraft(body))` 실패 시 422 `{ errors }`. 성공 시 `rpc('submit_application', { p_idempotency_key, p_payload: value })` → 200 `{ application, duplicate }`. 금액·회차는 서버가 정한다(클라이언트 값 무시).

- [ ] **Step 1:** `tests/db/repository.test.ts`(route 핸들러 함수를 직접 호출하거나 RPC를 사용자 클라이언트로 호출):
  - 잘못된 payload(공백 한 줄 소개) → 422, intro 오류
  - 같은 초안 2번 → 같은 신청 번호, duplicate=true
  - 세션 없음 → 401
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** `tests/e2e-supabase/flow.spec.ts`: dev 로그인(A) → 장소 저장 → 4단계 신청(새로고침 후 서버 초안 복원 확인) → 제출 3연타 → 완료 번호 → 내 약속 1건. 다른 브라우저 컨텍스트에서 B로 로그인하면 내 약속 0건, A의 저장 목록 안 보임.
- [ ] **Step 4:** 전체 검사: `npm run typecheck && npm test && npm run test:db && npm run build && npm run test:e2e && npm run test:e2e:supabase`
- [ ] **Step 5:** Commit `Supabase 데이터 연결: 저장·초안·신청을 로그인 사용자별로 저장`

### Task 8: 본인확인 mock 어댑터

**Files:**
- Create: `lib/verification/types.ts`, `lib/verification/mock.ts`, `lib/verification/index.ts`, `app/api/dev/verify/route.ts`, `tests/unit/verification.test.ts`

**Interfaces:**
- Produces: `interface VerificationProvider { start(userId: string): Promise<{ status: "pending"; ref: string }>; complete(ref: string, outcome: "verified" | "failed"): Promise<{ status: "verified" | "unverified" }> }`, `getVerificationProvider(env): VerificationProvider | null`(mock은 `devLoginAllowed`와 같은 조건일 때만, 아니면 null = 미검증 유지)
- `/api/dev/verify`(POST `{outcome}`): 조건 불충족 시 404. 충족 시 service role로 `private_profiles`를 갱신한다(verified면 `verified_at`·`provider_ref='mock:<ref>'`).
- 프로필 화면: 상태 배지 "본인확인 전 / 확인 중 / 확인 완료"와 "본인확인은 공급자 계약 후 제공돼요" 안내. 개발 모드에서만 "개발용: 확인 완료 처리" 버튼.

- [ ] **Step 1:** 실패 테스트: production env → `getVerificationProvider` null. 로컬+플래그 → mock이 verified를 돌려준다.
- [ ] **Step 2:** 구현 → PASS. E2E 한 줄 추가: 개발용 버튼 → 배지 "확인 완료".
- [ ] **Step 3:** Commit `본인확인 mock 어댑터 (개발 전용)`

### Task 9: 문서와 마무리

**Files:**
- Create: `docs/decisions/0004-supabase-stage2.md`
- Modify: `README.md`(supabase 모드 실행법: `npm run db:start`, `.env.local` 예시, Mailpit 주소), `CHANGELOG.md`, `docs/overview.md`(단계 2 상태), `CLAUDE.md` 프로젝트 메모(현재 단계·완료 전 확인에 `test:db` 추가), `.env.example`

- [ ] **Step 1:** 문서 작성. 결정 기록에는 위 "설계 결정"과 운영(호스팅) Supabase 연결 전 할 일을 적는다(실제 프로젝트 생성, 키를 Vercel 환경변수로, 이메일 발송 SMTP, 약관 본문).
- [ ] **Step 2:** 전체 검사 재실행 후 Commit `단계 2 문서`

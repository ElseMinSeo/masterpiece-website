# 단계 3: 운영자 소개·수락·일정/장소 합의 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 신청 큐에서 두 사람을 골라 소개하고, 두 사람이 24시간 안에 수락·패스하며, 양측 수락 후 운영자가 낸 장소·시간 후보 2개 중 같은 것을 고르면 약속이 '합의됨'이 되도록 한다.

**Architecture:** 단계 2와 같은 방식을 쓴다. 새 테이블은 RLS로 모두 막고(로그인 사용자에게 권한 없음), 상태 전이는 `service_role` 전용 DB 함수(security definer, 트랜잭션·행 잠금)로만 한다. Next 서버 경로가 세션으로 사용자를 확인하고 입력을 Zod로 검증한 뒤 함수를 부른다(`lib/apply/submit-server.ts`의 `submitForUser` 패턴). 상대 정보는 소개 시점에 만든 공개 동의 스냅샷만 서버가 돌려준다. 운영자·소개·약속 화면은 `supabase` 모드에서만 동작하고, `local-demo` 모드에서는 404다.

**Tech Stack:** Next.js 16 App Router(동적 경로의 `params`는 Promise — 코드 전에 `node_modules/next/dist/docs/`의 Route Handlers·Dynamic Routes 안내를 읽는다), Supabase(Postgres 17, RLS), Zod 4, Vitest(`test`, `test:db`), Playwright(`test:e2e:supabase`).

**Spec:** `ROADMAP.md` §1(핵심 흐름), §2 추가 화면(`/appointments`, `/offers/[id]`, `/appointments/[id]`, `/admin`), §3 F05·F06, §5(offers, offer_members, appointments, appointment_options, appointment_votes, 상태 전이), §6 단계 3, §8 T06·T07, §9 Prompt 3. 원본은 사용자가 준 압축 파일에 있고, 필요한 값은 아래에 옮겨 적었다.

## Global Constraints

- 자동 매칭은 하지 않는다. 운영자가 두 명을 직접 고른다. 겹침(역·시간·예산·나이)은 참고 정보로만 보여준다.
- 소개 상태: `pending → mutual_accepted | declined | expired`. 응답 기한 24시간(`expires_at = now() + interval '24 hours'`), 서버(DB 함수)에서 검증한다. 만료 후 수락 금지.
- 약속 상태 목록(이번에 `negotiating`, `agreed`, `cancelled`만 사용, 나머지는 단계 4·5용으로 CHECK에 미리 둔다): `negotiating, agreed, payment_pending, seat_pending, confirmed, completed, cancelled, disputed`.
- 양측 수락 후 운영자가 장소 후보 2곳(서로 다른 공개 장소)과 시간을 제안한다. **두 사람이 같은 후보를 골랐을 때만** `agreed`. 다르면 `negotiating` 유지(T07).
- 상대에게는 소개 시점 공개 동의 스냅샷만: 닉네임, 한 줄 소개(항상), 나의 성격(`disclose.personalities`일 때), 자기소개(`disclose.bio`이고 비어 있지 않을 때). 이메일·user_id·출생 연도·성별·흡연·예산·가능 일정은 절대 내보내지 않는다. 연락처는 공유하지 않는다.
- 소개 대상: 본인확인 `verified`, 계정 `active`, 신청 `submitted|reviewing`, 같은 회차, 서로 다른 사용자, 둘 다 진행 중(`pending`) 소개나 진행 중 약속(`negotiating|agreed`)이 없음.
- 새 테이블: RLS 켜고 `anon, authenticated` 권한 전부 회수. 함수는 `service_role`에만 실행 권한.
- 운영자 확인은 서버가 `admin_roles`로 한다(`public.is_admin()`은 세션 기준이라 service_role 호출에서는 `p_admin uuid`를 받아 `admin_roles`를 직접 조회).
- 시간은 UTC 저장, 화면은 Asia/Seoul. 시간대 시각은 기존 `public.slot_hours`와 `slotFitsDate`(평일 저녁=월~금, 주말 시간대=토·일)를 따른다.
- 알림(이메일·문자), 결제, 좌석 확인, 신고·차단은 이번 범위가 아니다(단계 4·5).
- 커밋 전: `npm run typecheck`, `npm test`, `npm run build && npm run test:e2e`, `npm run test:db`(먼저 `npm run db:start`), `npm run test:e2e:supabase`. 기존 테스트(단위 47, DB 39, E2E 7+7)는 계속 통과.
- 사용자에게 보이는 변경은 `CHANGELOG.md` "아직 배포 안 됨", 결정은 `docs/decisions/0005-stage3-matching.md`.

## Review Focus

1. **두 사람이 동시에 수락:** 두 응답이 같은 순간 들어와도 소개는 `mutual_accepted` 한 번, 약속은 정확히 1개 → Task 3 `동시에 둘 다 수락해도 약속은 1개` 테스트.
2. **만료 직후 수락:** `expires_at`이 지난 소개에 수락을 보내면 거절되고 소개는 `expired`, 두 신청은 다시 큐(`reviewing`)로 → Task 3 `만료된 소개는 수락할 수 없다` 테스트.
3. **같은 사람을 두 소개에 동시에 넣기:** 운영자 두 명(또는 더블클릭)이 A를 각각 B, C와 동시에 소개해도 하나만 성공 → Task 2 `같은 사람을 동시에 두 소개에 넣을 수 없다` 테스트.
4. **상대 비공개 정보 노출:** 소개 화면 응답(JSON 전체)에 상대 이메일·user_id·출생 연도·성별·예산·`disclose=false` 항목이 없어야 한다 → Task 6 `상대 정보는 공개 동의 스냅샷만` 테스트.
5. **두 사람이 동시에 투표:** 같은 후보를 동시에 골라도 `agreed`는 한 번이고, 서로 다른 후보를 동시에 고르면 `negotiating` 유지 → Task 4 `동시 투표` 테스트.

## 설계 결정 (계획에서 정함 — 다르게 원하면 실행 전에 알려주세요)

- **거절·만료 후 처리:** 소개가 `declined`/`expired`가 되면 두 신청 모두 `reviewing`으로 돌아가 운영자가 다시 소개할 수 있다. 같은 두 사람을 다시 소개하는 것은 막는다(이전 소개가 있으면 `create_offer`가 거절).
- **만료 처리 시점:** 예약 작업(cron) 없이, 소개를 만들거나 응답하거나 화면을 읽는 서버 함수가 먼저 `public.expire_due_offers()`를 불러 기한이 지난 소개를 정리한다.
- **성별 조합:** 규칙으로 막지 않는다. 운영자 화면에 두 사람의 성별과 서로의 상대 나이 조건 충족 여부를 보여주고 운영자가 판단한다.
- **장소 후보 2개:** 정확히 2개, 서로 다른 공개 장소. 각 후보는 `{ placeId, date, slotId }`이고, 그 날짜×시간대가 **두 사람 모두의** `availability`에 있어야 한다. 시각은 `slot_hours`로 계산.
- **투표 변경:** `negotiating` 동안은 고른 후보를 바꿀 수 있다. `agreed`가 되면 바꿀 수 없다.
- **신청 상태:** 소개를 보내면 두 신청은 `offered`. 양측 수락·합의 후에도 `offered` 유지(종료 처리는 단계 5).
- **데모 모드:** `/admin`, `/offers/*`, `/appointments/[id]`는 `local-demo`에서 `notFound()`. `/appointments` 목록은 데모에서 지금처럼 신청 상태만 보여준다.

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20261128000700_matching.sql` (Create) | offers, offer_members, appointments, appointment_options, appointment_votes 테이블·인덱스·RLS |
| `supabase/migrations/20261128000800_matching_functions.sql` (Create) | `expire_due_offers`, `create_offer`, `respond_offer`, `propose_options`, `vote_option`, `admin_queue`, `user_matches` |
| `lib/match/overlap.ts` (Create) | 두 신청의 겹침 계산(순수 함수) |
| `lib/match/types.ts` (Create) | 화면·서버가 공유하는 타입과 Zod 입력 스키마 |
| `lib/match/server.ts` (Create) | 세션 확인 → 검증 → DB 함수 호출 → `{status, body}` (운영자·사용자 동작 전부) |
| `app/api/admin/queue/route.ts`, `app/api/admin/offers/route.ts`, `app/api/admin/appointments/[id]/options/route.ts` (Create) | 운영자 API |
| `app/api/me/matches/route.ts`, `app/api/offers/[id]/respond/route.ts`, `app/api/appointments/[id]/vote/route.ts` (Create) | 사용자 API |
| `app/admin/page.tsx` (Create) | 운영자 큐·소개 발송·후보 제안 |
| `app/offers/[id]/page.tsx`, `app/appointments/[id]/page.tsx` (Create), `app/appointments/page.tsx` (Modify) | 사용자 소개·약속 화면 |
| `lib/supabase/proxy-session.ts` (Modify) | `PROTECTED_PREFIXES`에 `/admin`, `/offers` 추가 |
| `tests/db/matching.test.ts`, `tests/db/match-server.test.ts`, `tests/unit/overlap.test.ts`, `tests/e2e-supabase/matching.spec.ts` (Create), `tests/db/helpers.ts` (Modify) | 테스트 |

---

### Task 1: 매칭 테이블과 접근 규칙

**Files:**
- Create: `supabase/migrations/20261128000700_matching.sql`
- Modify: `tests/db/helpers.ts` (도우미 추가)
- Test: `tests/db/matching.test.ts`

**Interfaces:**
- Produces (테이블):
  - `offers(id uuid pk, cohort_id uuid fk cohorts, status text check in ('pending','mutual_accepted','declined','expired') default 'pending', expires_at timestamptz not null, created_by uuid fk auth.users, created_at, updated_at)`; 인덱스 `(status, expires_at)`
  - `offer_members(offer_id fk offers on delete cascade, user_id fk auth.users, application_id fk applications, profile_snapshot jsonb not null, response text check in ('accepted','declined') null, responded_at timestamptz, primary key (offer_id, user_id))`; 인덱스 `(user_id)`
  - `appointments(id uuid pk, offer_id uuid unique fk offers, status text check in (위 8개) default 'negotiating', selected_option_id uuid null, scheduled_at timestamptz null, created_at, updated_at)`; 인덱스 `(status, scheduled_at)`
  - `appointment_options(id uuid pk, appointment_id fk on delete cascade, place_id text fk places, slot_date date, slot_id text, starts_at, ends_at, check (ends_at > starts_at), unique (appointment_id, place_id))`
  - `appointment_votes(appointment_id fk, user_id fk, option_id fk appointment_options, voted_at, primary key (appointment_id, user_id))`
- Produces (테스트 도우미, `tests/db/helpers.ts`):
  - `makeVerifiedApplicant(tag: string, overrides?: Record<string, unknown>): Promise<TestUser & { applicationId: string }>` — `makeUser` + `verification_status='verified'` + `submit_application`(기본 `payload()`).
  - `makeOperator(tag: string): Promise<TestUser>` — `admin_roles`에 `operator` 추가.
  - `payload(overrides?)`를 `tests/db/applications.test.ts`에서 helpers로 옮겨 공유.

- [ ] **Step 1: 실패하는 테스트** — `describe("매칭 테이블 접근 규칙")`
  - `it("로그인 사용자는 소개·약속 테이블을 직접 읽거나 쓸 수 없다")`: 일반 사용자 클라이언트로 5개 테이블 `select` → `error`가 있거나 `data`가 `[]`; `offers` insert → `error` not null.
  - `it("운영자도 세션으로는 직접 쓸 수 없다")`: `makeOperator`로 `offers` insert → `error` not null.
- [ ] **Step 2:** `npm run test:db -- tests/db/matching.test.ts` → FAIL(테이블 없음)
- [ ] **Step 3:** 마이그레이션 작성. 모든 테이블 `enable row level security` + `revoke all ... from anon, authenticated`. `appointments`, `offers`에 `touch_updated_at` 트리거. 적용: `npx supabase migration up`
- [ ] **Step 4:** 같은 명령 → PASS, 이어서 `npm run test:db` 전체 PASS
- [ ] **Step 5:** 커밋 `단계 3: 매칭 테이블과 접근 규칙`

### Task 2: 소개 만들기 (`create_offer`, `expire_due_offers`, `admin_queue`)

**Files:**
- Create: `supabase/migrations/20261128000800_matching_functions.sql`(이 Task에서 시작, Task 3·4가 같은 파일에 함수 추가 — 아직 커밋 전 DB는 `npm run db:reset`으로 다시 적용)
- Test: `tests/db/matching.test.ts`

**Interfaces:**
- Produces (SQL, 모두 `security definer set search_path = ''`, `service_role`에만 execute):
  - `public.expire_due_offers() returns integer` — `pending`이고 `expires_at <= now()`인 소개를 `expired`로, 그 두 신청을 `reviewing`으로. 바꾼 개수 반환.
  - `public.create_offer(p_admin uuid, p_app_a uuid, p_app_b uuid) returns public.offers` — 먼저 `expire_due_offers()`. `p_admin`이 `admin_roles`에 없으면 `42501`. 두 신청을 `id` 순서로 `for update` 잠금(교착 방지). 조건(Global Constraints "소개 대상")·같은 두 사용자의 이전 소개 없음을 확인, 어기면 `P0001`과 사유 메시지(`'not eligible: <사유>'`). 소개 1행 + 멤버 2행(스냅샷 포함) 생성, 두 신청 `offered`.
  - `public.admin_queue(p_admin uuid, p_cohort uuid) returns jsonb` — 운영자 확인 후 소개 가능 신청 목록: `[{ applicationId, number, nickname, gender, birthYear, stations, budgetMin, budgetMax, ageMin, ageMax, availability: [{date, slotId}], submittedAt }]`. 기존 `introducible_applications`와 같은 조건 + 진행 중 소개·약속 없는 사람만.
  - 스냅샷 형식(`profile_snapshot`): `{ nickname: string, intro: string, personalities?: string[], bio?: string }`.

- [ ] **Step 1: 실패하는 테스트** — `describe("소개 만들기")`
  - `it("운영자가 두 신청을 소개하면 24시간 기한의 pending 소개와 멤버 2명이 생기고 신청은 offered")`: `expires_at`이 지금+24시간 ±1분; 두 신청 `status === "offered"`.
  - `it("스냅샷에는 공개 동의한 항목만 들어간다")`: A는 `disclose: { personalities: false, intro: true, bio: true }`, `bio: "주말엔 전시"`; A 스냅샷 `toEqual({ nickname, intro, bio: "주말엔 전시" })`(personalities 키 없음).
  - `it("일반 사용자는 소개를 만들 수 없다")`: `p_admin`에 일반 사용자 id → error code `42501`.
  - `it("본인확인 전·같은 사람·다른 회차·이미 소개 중인 신청은 소개할 수 없다")`: 각 경우 error 메시지에 `not eligible`.
  - `it("같은 두 사람을 다시 소개할 수 없다")`: 소개 → 거절(Task 3 전이므로 테스트에서 service role로 `status='declined'`·신청 `reviewing`으로 바꿔 준비) → 같은 쌍 재소개 error.
  - `it("같은 사람을 동시에 두 소개에 넣을 수 없다")`: `Promise.all([create(A,B), create(A,C)])` → 성공 1개, 실패 1개; A의 `offer_members` 1행.
  - `it("큐에는 소개 가능한 신청만 나온다")`: 소개된 A·B는 `admin_queue` 결과에 없음, 미인증 신청 없음.
- [ ] **Step 2:** `npm run test:db -- tests/db/matching.test.ts` → FAIL
- [ ] **Step 3:** 함수 3개 구현(위 Interfaces). `admin_queue`의 `availability`는 `availability` 테이블에서 `jsonb_agg`.
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `단계 3: 운영자 소개 만들기`

### Task 3: 수락·패스·만료 (`respond_offer`)

**Files:**
- Modify: `supabase/migrations/20261128000800_matching_functions.sql`
- Test: `tests/db/matching.test.ts`

**Interfaces:**
- Consumes: Task 2 `create_offer`, `expire_due_offers`.
- Produces: `public.respond_offer(p_user uuid, p_offer uuid, p_response text) returns public.offers` — 먼저 `expire_due_offers()`. 소개 행 `for update`. 멤버가 아니면 `42501`. `p_response`가 `accepted|declined`가 아니면 `22023`. 상태가 `expired`면 `P0001 'offer expired'`, 그 외 `pending`이 아니면 `P0001 'offer closed'`. 이미 응답했으면 같은 응답은 그대로 반환, 다른 응답은 `P0001 'already responded'`. 거절이면 소개 `declined` + 두 신청 `reviewing`. 둘 다 수락이면 `mutual_accepted` + `appointments` 1행(`negotiating`).

- [ ] **Step 1: 실패하는 테스트** — `describe("수락·패스·만료")`
  - `it("한 명만 수락하면 pending, 둘 다 수락하면 mutual_accepted와 negotiating 약속 1개")`
  - `it("한 명이 패스하면 declined이고 두 신청은 다시 큐로(reviewing)")`
  - `it("만료된 소개는 수락할 수 없다")`: service role로 `expires_at = now() - 1초` → `respond_offer(accepted)` error 메시지 `offer expired`; 소개 `expired`; 두 신청 `reviewing`.
  - `it("동시에 둘 다 수락해도 약속은 1개")`: `Promise.all([respond(A), respond(B)])` → 둘 다 error null; `appointments` where `offer_id` 1행.
  - `it("소개 멤버가 아니면 응답할 수 없다")` → `42501`
  - `it("수락 후 패스로 바꿀 수 없다")` → `already responded`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** PASS 확인
- [ ] **Step 5:** 커밋 `단계 3: 소개 수락·패스·24시간 만료`

### Task 4: 후보 제안과 합의 (`propose_options`, `vote_option`)

**Files:**
- Modify: `supabase/migrations/20261128000800_matching_functions.sql`
- Test: `tests/db/matching.test.ts`

**Interfaces:**
- Consumes: Task 3에서 만든 `negotiating` 약속.
- Produces:
  - `public.propose_options(p_admin uuid, p_appointment uuid, p_options jsonb) returns setof public.appointment_options` — 운영자 확인. 약속이 `negotiating`이고 아직 후보가 없어야 함(`P0001 'options exist'`). `p_options`는 정확히 2개 `[{placeId, date, slotId}]`, 서로 다른 `published` 장소, 각 `(date, slotId)`가 두 신청의 `availability`에 모두 있어야 함 — 아니면 `22023`과 사유.
  - `public.vote_option(p_user uuid, p_appointment uuid, p_option uuid) returns public.appointments` — 약속 `for update`. 두 멤버 중 하나가 아니면 `42501`. 약속이 `negotiating`이 아니면 `P0001 'appointment closed'`. 후보가 이 약속 것이 아니면 `22023`. 투표 upsert. 두 표가 같은 후보면 `agreed`, `selected_option_id`, `scheduled_at = 후보 starts_at`.

- [ ] **Step 1: 실패하는 테스트** — `describe("후보 제안과 합의")` (도우미 `makeNegotiating(): Promise<{ a, b, op, appointmentId }>`를 이 파일에 둔다)
  - `it("두 사람 모두 가능한 날짜·시간대의 서로 다른 장소 2곳을 제안한다")`: `starts_at`이 서울 19시(평일 저녁) UTC 값과 같음.
  - `it("후보가 2개가 아니거나 같은 장소이거나 한쪽만 가능한 시간이면 거절")`
  - `it("서로 다른 후보를 고르면 negotiating, 같은 후보로 맞추면 agreed")` (T07)
  - `it("동시 투표: 같은 후보를 동시에 골라도 agreed 한 번")` — `Promise.all`, 이후 `appointments.status === "agreed"`, `selected_option_id` 일치.
  - `it("합의 후에는 다시 고를 수 없고, 약속 멤버가 아니면 투표할 수 없다")`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** `npm run db:reset && npm run test:db` → 전체 PASS
- [ ] **Step 5:** 커밋 `단계 3: 장소·시간 후보 제안과 양측 합의`

### Task 5: 겹침 계산 (운영자 참고 정보)

**Files:**
- Create: `lib/match/overlap.ts`, `lib/match/types.ts`
- Test: `tests/unit/overlap.test.ts`

**Interfaces:**
- Produces (`lib/match/types.ts`):
  - `interface QueueItem { applicationId: string; number: string; nickname: string; gender: string; birthYear: number; stations: string[]; budgetMin: number; budgetMax: number; ageMin: number; ageMax: number; availability: { date: string; slotId: string }[]; submittedAt: string }` (`admin_queue` JSON과 같은 모양)
  - `interface Overlap { stations: string[]; slots: { date: string; slotId: string }[]; budget: { min: number; max: number } | null; aFitsB: boolean; bFitsA: boolean }`
  - Zod: `createOfferInput = z.object({ applicationA: z.uuid(), applicationB: z.uuid() })`, `respondInput = z.object({ response: z.enum(["accepted","declined"]) })`, `optionsInput = z.object({ options: z.array(z.object({ placeId: z.string().min(1).max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slotId: z.string() })).length(2) })`, `voteInput = z.object({ optionId: z.uuid() })`
- Produces (`lib/match/overlap.ts`): `overlap(a: QueueItem, b: QueueItem, now?: Date): Overlap` — 나이는 서울 기준 올해 − 출생 연도(만 나이 아님, 화면에 "연 나이 기준" 표시).

- [ ] **Step 1: 실패하는 테스트** (`tests/unit/overlap.test.ts`, `NOW`는 `tests/unit/helpers.ts`)
  - `it("공통 역과 공통 날짜×시간대를 돌려준다")`
  - `it("예산 구간이 겹치지 않으면 budget은 null")`: A 2만~3만, B 4만~5만 → `null`; A 2만~4만, B 3만~5만 → `{ min: 30000, max: 40000 }`
  - `it("서로의 상대 나이 조건을 만족하는지 각각 알려준다")`
- [ ] **Step 2:** `npx vitest run tests/unit/overlap.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** PASS
- [ ] **Step 5:** 커밋 `단계 3: 신청 겹침 계산`

### Task 6: 서버 처리와 API 경로

**Files:**
- Create: `lib/match/server.ts`, API 경로 6개(File Structure 표)
- Test: `tests/db/match-server.test.ts`

**Interfaces:**
- Consumes: Task 2~4 SQL 함수, Task 5 Zod 스키마와 `QueueItem`.
- Produces (`lib/match/server.ts`, 모두 `(userDb: SupabaseClient, serverDb: SupabaseClient, ...) => Promise<MatchResponse<T>>`, `type MatchResponse<T> = { status: 200; body: T } | { status: 401|403|404|409|422|500; body: { error: string } }`):
  - `getQueue(userDb, serverDb)` → `{ items: QueueItem[]; offers: AdminOfferView[] }` (운영자 아니면 403)
  - `sendOffer(userDb, serverDb, body: unknown)` → `{ offerId: string }`
  - `proposeOptions(userDb, serverDb, appointmentId: string, body: unknown)` → `{ ok: true }`
  - `getMyMatches(userDb, serverDb)` → `{ offers: MyOfferView[]; appointments: MyAppointmentView[] }`
  - `respond(userDb, serverDb, offerId: string, body: unknown)` → `{ status: OfferStatus }`
  - `vote(userDb, serverDb, appointmentId: string, body: unknown)` → `{ status: AppointmentStatus }`
  - `AdminOfferView = { id; status: OfferStatus; expiresAt; members: { number: string; nickname: string; response: "accepted"|"declined"|null }[]; appointmentId: string|null; appointmentStatus: AppointmentStatus|null; hasOptions: boolean; commonSlots: { date: string; slotId: string }[] }` — 운영자 화면의 진행 중 소개·후보 제안용. `OfferStatus`, `AppointmentStatus`는 `lib/match/types.ts`에 Global Constraints의 상태 문자열 유니온으로 둔다.
  - `MyOfferView = { id; status; expiresAt; myResponse: "accepted"|"declined"|null; partner: { nickname; intro; personalities?; bio? } }` — 상대 스냅샷만.
  - `MyAppointmentView = { id; status; scheduledAt: string|null; options: { id; placeId; placeName; startsAt; endsAt }[]; myOptionId: string|null; partnerVoted: boolean; partner: MyOfferView["partner"] }` — 상대가 고른 후보 id는 주지 않는다(합의 전 영향 방지).
  - SQL 오류 매핑: `42501`→403, `P0001`→409(메시지는 한국어로: `offer expired`→"응답 기한(24시간)이 지났어요.", `already responded`→"이미 응답했어요.", `not eligible`→"지금은 소개할 수 없는 신청이에요.", `appointment closed`→"이미 확정된 약속이에요."), `22023`→422, 그 외 500. 로그인 없음 401, Zod 실패 422.
  - 읽기 함수는 SQL `public.user_matches(p_user uuid) returns jsonb`(Task 4 파일에 추가)를 호출해 한 번에 가져온다.
- 경로: 각 `route.ts`는 `submit` 경로처럼 `createServerSupabase()`, `createAdminSupabase()`를 넘기고 `NextResponse.json(res.body, { status: res.status })`. `dataSource() !== "supabase"`면 404. 동적 `params`는 `await`.

- [ ] **Step 1: 실패하는 테스트** (`tests/db/match-server.test.ts`)
  - `it("로그인 안 하면 401, 운영자가 아니면 큐·소개 발송·후보 제안이 403")`
  - `it("형식이 틀린 요청은 422")`: `sendOffer`에 `{ applicationA: "x" }`
  - `it("상대 정보는 공개 동의 스냅샷만")`: `getMyMatches` 결과를 `JSON.stringify` → 상대 이메일, 상대 user id, `"birthYear"`, `"budgetMin"`, 비공개로 둔 성격 값이 문자열에 없음.
  - `it("만료된 소개에 응답하면 409와 안내 문구")`: body.error `"응답 기한(24시간)이 지났어요."`
  - `it("합의 전에는 상대가 고른 후보를 알려주지 않는다")`: 상대만 투표한 상태에서 `partnerVoted === true`, 응답에 상대 `option_id` 없음.
- [ ] **Step 2:** `npm run test:db -- tests/db/match-server.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** PASS, `npm run typecheck` PASS
- [ ] **Step 5:** 커밋 `단계 3: 소개·약속 서버 처리와 API`

### Task 7: 운영자 화면 `/admin`

**Files:**
- Create: `app/admin/page.tsx` (필요하면 `components/admin/*.tsx`로 분리)
- Modify: `lib/supabase/proxy-session.ts` (`PROTECTED_PREFIXES`에 `"/admin"`, `"/offers"`)
- Test: `tests/e2e-supabase/matching.spec.ts`

**Interfaces:**
- Consumes: `GET /api/admin/queue`, `POST /api/admin/offers`, `POST /api/admin/appointments/[id]/options`, `overlap()`.
- 화면: (1) 소개 가능 신청 카드 목록(번호·닉네임·성별·연 나이·역·예산·가능 일정) — 체크로 정확히 2명 선택 시 아래에 `overlap` 요약(공통 역/일정/예산, 나이 조건 충족 여부)과 "소개 보내기" 버튼. 공통 일정이 없으면 경고 문구만, 발송은 막지 않음. (2) 진행 중 소개(상태·남은 시간·각자 응답). (3) `negotiating`이고 후보 없는 약속: 두 사람 공통 일정 중에서 날짜·시간대와 장소(공개 장소 목록)를 골라 후보 2개 제출. 장소는 `lib/data/places.ts`의 목록 사용.
- 운영자가 아니면 서버 컴포넌트에서 `notFound()`. 데모 모드에서도 `notFound()`. 하단 메뉴에는 넣지 않는다.
- 320/375/430px에서 가로 넘침 없음(기존 `layout.spec.ts` 방식 참고).

- [ ] **Step 1: 실패하는 E2E** (`tests/e2e-supabase/matching.spec.ts`, 테스트 로그인 `POST /api/dev/login` 사용; 본인확인·운영자 권한·신청은 테스트 준비에서 service role로 만든다)
  - `test("운영자가 아니면 /admin은 404")`
  - `test("운영자가 두 신청을 골라 소개를 보내면 큐에서 사라지고 진행 중 소개에 나온다")`
- [ ] **Step 2:** `npm run test:e2e:supabase -- -g "운영자"` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** PASS
- [ ] **Step 5:** 커밋 `단계 3: 운영자 화면`

### Task 8: 사용자 화면 (내 약속·소개·약속 상세)

**Files:**
- Modify: `app/appointments/page.tsx`
- Create: `app/offers/[id]/page.tsx`, `app/appointments/[id]/page.tsx`
- Test: `tests/e2e-supabase/matching.spec.ts`, `tests/e2e/flow.spec.ts`(데모 모드 회귀 확인만)

**Interfaces:**
- Consumes: `GET /api/me/matches`, `POST /api/offers/[id]/respond`, `POST /api/appointments/[id]/vote`.
- `/appointments`: supabase 모드에서 신청 상태 아래에 소개(상태·남은 시간)와 약속(상태·합의 일시) 목록, 각 항목 링크. 데모 모드는 지금 그대로.
- `/offers/[id]`: 상대 닉네임·한 줄 소개·(공개 시) 성격·자기소개, 남은 시간(서울 기준 "11월 29일 오후 3시까지"), "수락"·"패스" 버튼(패스는 확인 한 번 더). 응답 후 상태 문구: 상대 응답 대기 / 양측 수락 → 약속 링크 / 거절됨 / 기한 지남.
- `/appointments/[id]`: 후보 2개를 나란히 비교(장소명·동네·가격대·소음·좌석·일시), 하나 선택. 상대가 골랐는지만 표시. 서로 다르면 "서로 다른 후보를 골랐어요. 다시 맞춰주세요." 합의되면 확정 일시·장소와 "결제·좌석 확인은 다음 단계에서 안내돼요".
- 버튼은 요청 중 비활성(연속 클릭 방지). 오류는 `role="alert"`.

- [ ] **Step 1: 실패하는 E2E**
  - `test("두 사람이 수락하고 같은 후보를 고르면 약속이 합의된다")`: A·B 각자 브라우저 컨텍스트. A 수락 → "상대 응답 대기"; B 수락 → 약속 링크; (준비 단계에서 운영자 API로 후보 제안) A는 후보 1, B는 후보 2 → 재조율 문구; B가 후보 1로 바꿈 → 두 화면 모두 "합의됨".
  - `test("기한이 지난 소개는 수락 버튼 대신 기한 지남 안내")`: service role로 `expires_at` 과거로.
  - `test("패스하면 소개가 종료된다")`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** `npm run build && npm run test:e2e`(데모 7개 그대로) + `npm run test:e2e:supabase` PASS
- [ ] **Step 5:** 커밋 `단계 3: 소개 응답과 약속 합의 화면`

### Task 9: 문서와 전체 검사

**Files:**
- Create: `docs/decisions/0005-stage3-matching.md` (위 "설계 결정" 7가지와 이유)
- Modify: `docs/decisions/README.md`, `CHANGELOG.md`("아직 배포 안 됨"), `docs/design-notes.md`(미확정 가정값: 24시간, 후보 2개, 거절 시 재큐), `CLAUDE.md`의 "프로젝트 메모"(현재 단계 3), `README.md`(운영자 계정 만드는 법: 로컬에서 `admin_roles` insert SQL 한 줄)

- [ ] **Step 1:** 문서 작성
- [ ] **Step 2:** `npm run typecheck && npm test && npm run db:reset && npm run test:db && npm run build && npm run test:e2e && npm run test:e2e:supabase` → 모두 PASS
- [ ] **Step 3:** 커밋 `단계 3 문서: 결정 기록, 변경 기록, 실행 방법`
- [ ] **Step 4:** 작업 브랜치에 푸시. PR은 사용자가 요청할 때만.

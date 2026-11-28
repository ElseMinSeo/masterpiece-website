# 첫, 길 (masterpiece-first-path)

운영자가 첫 만남을 소개하고, 두 사람이 시간과 장소를 고르면 예약까지 연결하는 서비스입니다.
이 저장소는 **첫, 길 모바일 웹** 개발 전용입니다.

현재는 **MVP 단계 2 (계정과 데이터)** 까지 왔습니다. 두 가지 방식으로 실행할 수 있어요.

- **데모 모드(기본)**: 외부 계정·키 없이 실행. 데이터는 브라우저에만 저장. Vercel 공개 데모가 이 방식입니다.
- **Supabase 모드**: 로컬 Supabase(Docker)에 로그인 사용자별로 저장. 이메일 코드 로그인과 약관 동의가 붙습니다.

모든 인물·장소·글은 개발용 가상 데이터입니다. 서비스 개요는 [docs/overview.md](docs/overview.md)에 있습니다.

## 실행

[Node.js](https://nodejs.org/) 20 이상이 필요합니다.

```bash
npm install
npm run dev          # http://localhost:3000 을 브라우저(모바일 화면 크기)로 열기
```

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (포트 3000) |
| `npm run build` / `npm start` | 배포용 빌드 / 실행 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm test` | Vitest 단위 테스트 (검증 규칙·저장소·필터) |
| `npm run build && npm run test:e2e` | Playwright 화면 테스트 (포트 3100, 320/375/430px 포함) |
| `npm run db:start` / `db:stop` | 로컬 Supabase 켜기/끄기 (Docker 필요) |
| `npm run db:reset` | 로컬 DB를 마이그레이션과 seed로 다시 만들기 |
| `npm run test:db` | DB 접근 규칙(RLS)·제출 함수 통합 테스트 (로컬 Supabase 필요) |
| `npm run test:e2e:supabase` | Supabase 모드 화면 테스트 (포트 3200) |
| `npm run db:seed:gen` | `lib/data/places.ts`로 `supabase/seed.sql` 다시 만들기 |

## Supabase 모드로 실행하기

1. [Docker](https://www.docker.com/)를 켜고 `npm run db:start` (처음엔 이미지를 받느라 몇 분 걸려요).
2. `npx supabase status -o env`의 값으로 `.env.local`을 만듭니다 (`.env.example` 참고).
   ```bash
   NEXT_PUBLIC_DATA_SOURCE=supabase
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
   DEV_TEST_LOGIN=1   # 선택: 개발용 테스트 로그인·본인확인 흉내
   ```
3. `npm run dev` → http://localhost:3000. 로그인 코드 메일은 **http://127.0.0.1:54324** (Mailpit)에서 확인합니다.

## 스택

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS 4 · Zod 4 · Vitest · Playwright

## 폴더 구조

```
app/                 화면 (home, places, places/[id], daily, saved, appointments, profile, apply/1·2·3·4·confirm·done)
components/          재사용 UI: TopBar, BottomNav, Button, Card, TagChip, OptionCard, TextInput, StepIndicator,
                     PlaceCard, BookmarkButton, ApplicationCard, AgeRange
lib/apply/           신청서 선택지, Zod 검증(단계별·제출 전체), 날짜 도우미
lib/data/            개발용 가상 장소·데일리 글 (출시 전 교체 대상)
lib/repo/            데이터 접근 계약(AppRepository): localStorage 데모 구현과 Supabase 구현
lib/supabase/        Supabase 클라이언트(브라우저·서버·관리자)와 로그인 세션 처리
lib/verification/    본인확인 공급자 계약과 개발용 흉내 공급자
proxy.ts             supabase 모드에서 로그인·필수 동의 확인 (Next 16의 middleware)
supabase/            로컬 설정, 마이그레이션(테이블·접근 규칙), seed, 로그인 메일 템플릿
lib/store.tsx        화면 전체가 공유하는 상태(저장 목록·초안·신청)
tests/unit, tests/db, tests/e2e, tests/e2e-supabase
docs/                서비스 개요, 시안 대비 차이, 결정 기록
.github/             이슈·PR 양식
CLAUDE.md, AGENTS.md AI 작업 규칙
CHANGELOG.md         버전별 변경 기록
.claude/             Claude Code 설정과 디자인 스킬 (아래 "디자인 도구" 참고)
.agents/skills/      외부에서 받은 스킬 원본 (impeccable, stageshow)
resources/           참고 자료 (앱 코드와 무관, 빌드·검사 대상 아님)
```

## 디자인 도구

Claude Code로 작업할 때 쓰는 도구입니다. 앱 실행에는 필요 없습니다.

| 이름 | 위치 | 용도 |
|---|---|---|
| impeccable | `.agents/skills/impeccable` | 화면 디자인 점검과 다듬기 |
| stageshow | `.agents/skills/stageshow` | 제품 소개용 화면 연출·애니메이션 |
| web-design-guidelines | `.claude/skills/` | 웹 디자인 가이드라인 점검 |
| imagegen-frontend-mobile / web, image-to-code, brandkit | `.claude/skills/` | 이미지 생성, 이미지를 코드로 옮기기, 브랜드 자료 |
| ponytail 플러그인 | `.claude/settings.json` | Claude Code 플러그인과 상태 표시줄 |
| awesome-design-md | `resources/awesome-design-md` | 여러 서비스의 디자인 규칙 모음 (참고용) |
| phonebox | `resources/phonebox` | 휴대폰 화면 관련 외부 도구 (참고용) |

외부 스킬의 출처와 버전은 `skills-lock.json`에 기록되어 있습니다.

### 데이터 계층 교체 방법 (단계 2)

화면은 `getRepository()`가 돌려주는 `AppRepository`만 사용합니다. 단계 2에서 Supabase 구현을 추가하고
`lib/repo/index.ts`에서 `NEXT_PUBLIC_DATA_SOURCE`에 따라 고르도록 바꾸면 됩니다. 제출 검증(`parseSubmission`)은
서버 액션에서도 그대로 재사용할 수 있게 순수 함수로 분리했습니다.

### 중복 제출 방지

1. 버튼: 진행 중 플래그(ref)로 같은 틱의 연속 클릭을 차단
2. 저장소: 초안마다 `idempotencyKey`를 두고, 같은 키의 동시 요청은 하나의 Promise로 합치며 이미 만든 신청을 돌려줌
3. 저장소: 진행 중(`submitted/reviewing/offered`) 신청이 있으면 새 신청을 만들지 않음 (DB 단계에서 회차별 유일 제약으로 대체)

### 브라우저 저장소

`localStorage`의 `cheotgil.demo.v1.*` 키에 데모 데이터(닉네임·저장 목록·신청 초안·신청 내역)만 저장합니다.
프로필 화면의 **데모 데이터 초기화**로 지울 수 있습니다.

## 작업 흐름

1. **이슈 만들기:** 할 일이나 버그를 GitHub Issues에 적습니다. 양식이 준비되어 있습니다.
2. **브랜치에서 작업:** main에 바로 고치지 않고, 작업용 브랜치를 만들어 거기서 고칩니다.
3. **PR 열기:** 브랜치의 변경 내용을 main에 합쳐 달라는 요청입니다. 무엇을 왜 바꿨는지 적습니다.
4. **확인 후 머지:** 테스트가 통과하고 내용을 확인했으면 main에 합칩니다.

### 용어

- **main:** 항상 정상 상태를 유지하는 기본 브랜치
- **브랜치:** main을 건드리지 않고 따로 작업하는 복사본
- **커밋:** 변경 내용을 저장한 기록 한 단위
- **PR (Pull Request):** 브랜치를 main에 합쳐 달라는 요청. 합치기 전에 변경 내용을 검토하는 곳

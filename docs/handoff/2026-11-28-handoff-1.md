# active-memory handoff: 첫, 길 모바일 웹 MVP

**Handoff #1** · 2026-11-28 · Lineage: #1 (2026-11-28): MVP 0~1단계 구현 → 새 Figma 시안 반영 → Vercel 안내·noindex → 2단계(로컬 Supabase) 구현·검토 수정 → 코드 리뷰 3종 실행, 수정은 승인 대기

## 0. Instructions for Claude (read first)

You are continuing work from a previous chat. That chat is gone; this file is the complete context and the source of truth.

1. Read this whole file before replying.
2. Follow sections 3 (Style), 4 (Hard rules) and 5 (Corrections) in every reply, for the rest of this chat. They override your defaults.
3. Use the values in section 8 exactly. Never round, re-estimate, or "correct" them.
4. Do not suggest anything listed in section 7 (Changed / rejected) again unless the user brings it up.
5. Code word: Start every reply with exactly "Yes Boss!"
6. Your first reply: at most 5 lines covering the goal, the current state, and the next step (section 11). Mention any files from section 13 that were not attached. Ask the questions in section 12 if there are any. End with "Ready to continue with <next step>?" Then wait for the user's go.

## 1. Mission
- **Goal:** 성인 두 사람의 첫 만남을 운영자가 소개하고, 두 사람이 시간·장소를 고르면 예약까지 연결하는 한국어 모바일 웹 '첫, 길' MVP를 로드맵 단계별로 개발.
- **Done looks like:** 로드맵 각 단계의 인수 기준(빌드·타입 검사·핵심 동작 테스트 통과, 320/375/430px 확인)을 만족하고, 사용자가 직접 눌러볼 수 있는 상태.
- **Why it matters / context:** 한 생활권에서 실제 유료 만남 1쌍 성사 과정을 검증하는 파일럿(1인 9,900원, 식음료 별도).

## 2. About the user (as relevant to this work)
- 전문 개발자가 아님. Figma 시안 보유(팀 MasterPiece, Figma Starter 플랜), GitHub·Vercel(Hobby, 팀 "Masterpiece") 사용, iPad/브라우저에서 확인.
- 이메일·개인정보는 외부 서비스에 보내지 않는다.

## 3. Style & communication
- **Language:** 한국어로 대화.
- **Tone:** 기술 용어는 쉽게 풀어서, 선택지가 있으면 추천안 함께 제시.
- **Reply length:** 결과 위주로 짧게, 표·목록 활용.
- **Formatting:** 제목·표·목록 사용. 결과 보고 시 무엇을 했는지 / 테스트 결과 / 사용자가 정할 것.
- **Working style:** 큰 결정은 AskUserQuestion으로 추천안과 함께 질문. 구현은 테스트 먼저(TDD), 커밋 전 전체 검사. 설치된 스킬·플러그인을 적극 활용(사용자가 명시적으로 원함).
- **Avoid:** 확인하지 않고 "안 된다"고 말하기, 스킬·플러그인을 두고도 안 쓰기.

## 4. Hard rules (word for word)
(저장소 `CLAUDE.md`에 있는 규칙. 저장소를 열면 다시 읽을 것)
1. "사용자와는 한국어로 대화합니다."
2. "되돌리기 어려운 작업(파일 대량 삭제, 강제 푸시, 저장소 설정 변경)은 먼저 확인받습니다."
3. "작업은 브랜치에서 하고, 사용자가 요청할 때만 PR을 만듭니다."
4. "PR은 `.github/pull_request_template.md` 양식을 따릅니다."
5. "줄바꿈 형식 등 기존 파일의 형식을 함부로 바꾸지 않습니다."
6. "사용자에게 보이는 변경은 `CHANGELOG.md`의 "아직 배포 안 됨" 항목에 적습니다."
7. "기술 선택 같은 중요한 결정은 `docs/decisions/`에 기록합니다."
8. 커밋 전: `npm run typecheck` / `npm test` / `npm run build && npm run test:e2e`(화면 변경 시) / `npm run test:db`(DB 변경 시, 먼저 `npm run db:start`) / `npm run test:e2e:supabase`(로그인·저장 흐름 변경 시)
9. "`.agents/`와 `resources/`는 외부에서 받은 자료입니다. 직접 고치지 않고, 앱 코드에서 가져다 쓰지 않습니다."
10. AGENTS.md: 이 Next.js 버전은 학습 데이터와 다름 → 코드 전 `node_modules/next/dist/docs/` 확인 (예: middleware → `proxy.ts`).
11. START.md: 출시용 사진·상호·평점 사용 금지, 개발용 데이터임을 명시. 운영 배포·실결제는 별도 승인 후.
12. 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <현재 세션 URL>` (세션이 제공하는 값 사용).

## 5. Corrections log
| # | Claude did | The user wanted |
|---|---|---|
| 1 | Figma 원본을 "로그인 없이 열 수 없다"고 보고했지만 실제로는 시도하지 않음 | 연결된 도구(Figma 등)를 실제로 시도한 뒤 정확히 보고 |
| 2 | 저장소에 넣은 스킬(impeccable 등)과 설치된 플러그인을 쓰지 않음 | "스킬 잘 활용하고 있니?", "말고도 플러그인들 많잖아" → 관련 스킬·플러그인을 적극 활용 |
| 3 | 커밋 후 푸시를 하지 않고 검토를 기다림 (훅 지적) | 커밋하면 작업 브랜치에 바로 푸시 |
| 4 | 2단계 검토에서 "작성 중 신청서 되살아남" 문제를 사소로 미룸 → 이후 코드 리뷰에서 중요로 재분류 | 사용자 영향 기준으로 심각도 판단 |

## 6. Decisions
| Decision | Why |
|---|---|
| 매칭 신청 = 4단계(1 기본정보·2 취향·3 나·4 상대) + 제출 전 확인 | 새 시안 + START 명세 항목 모두 유지 (사용자 선택) |
| 시안의 '이름' → 닉네임(최대 12자), 실명 미수집 | 개인정보 (사용자 선택) |
| 홈 = 새 시안 레이아웃 + 상단 배너에 매칭 신청/진행 중 신청 | 사용자 선택 |
| 강조색 #EF5FB4, 작은 글씨 #C2338A | 새 시안 + 대비 4.5:1 (사용자 선택) |
| 데모 기간 noindex (meta + X-Robots-Tag) | 공유용 Vercel 주소 검색 노출 방지 (사용자 요청) |
| 데이터 모드: `local-demo`(기본, Vercel) / `supabase`(로컬) | 결정 기록 0004 |
| 제출 함수 `submit_application(p_user_id,…)`는 service_role 전용, 서버가 Zod 검증 후 호출 | 검증 우회 방지 |
| 2단계 실행 방식: "내가 직접 진행"(마지막에 검토자 1명) | 사용자 선택 |
| PR은 squash merge로 main에 합침 | #5, #6에서 사용 |

## 7. Changed / rejected
- 3단계 신청 → 4단계 신청 (새 시안)
- 만남 템포 '채팅 후 결정' → '일정 확인 후 결정' (채팅 후순위)
- 하단 메뉴 홈·데일리·큐레이팅·저장·프로필 → 홈·장소·내 약속·저장·프로필 (D01 승인 필요)
- 강조색 #FF3374 → #EF5FB4
- 명세 2단계 '데이트 스타일' → '선호 장소'로 합침
- ❌ 네트워크 전체 개방 (필요한 Figma·Mobbin·GitHub 연결은 이미 됨, 막힌 건 요금제 한도)
- ❌ Mobbin 사용 (유료 플랜 필요)
- ❌ robots.txt로 크롤링 차단 (noindex를 못 읽게 됨)
- ❌ 브랜치 강제 푸시 (CLAUDE.md 규칙 → main을 merge하는 방식으로 동기화)

## 8. Data & facts (exact)
| 항목 | 값 |
|---|---|
| GitHub 저장소 | `ElseMinSeo/masterpiece-first-path` (옛 이름 `masterpiece-website`; 이 세션 GitHub 도구는 옛 이름으로만 허용됐음) |
| 작업 브랜치 | `claude/chul-gil-mobile-mvp-atqzi9` |
| main에 합친 PR | #4(사용자), #5(새 시안), #6(noindex). 2단계는 브랜치에만 있음 (마지막 커밋 `732940d`) |
| Vercel | 프로젝트 `masterpiece-first-path`, 팀 Masterpiece(Hobby), Framework Next.js, Root `./` |
| Figma | 파일 키 `r5urbsBvGHxIFTXu6gRwM2`, 섹션 `120:764`; 프레임 main `138:38815`, Details_menu `138:40190`, Matching1 `138:40936`, Matching2 `138:41055`, Matching3 `138:41209`, Matching4 `138:41325`. Starter 플랜 MCP 호출 한도 초과 상태 |
| 스택 | Next 16.4.6, React 19.3.1, TypeScript 5.9.2, Tailwind 4.1.13, Zod 4.6.7, Vitest 5.1.2, @playwright/test 1.63.0, supabase CLI 3.4.0, @supabase/supabase-js 2.119.2, @supabase/ssr 0.12.7, Node v22.23.5 |
| 로컬 Supabase | API `http://127.0.0.1:54321`, DB `54322`, Mailpit `http://127.0.0.1:54324`. 이미지는 Docker Hub(`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`, `npm run db:start`에 포함). 데몬 꺼져 있으면 `dockerd &` |
| 포트 | dev 3000, e2e 3100, e2e:supabase 3200 (빌드 폴더 `.next-supabase`) |
| 테스트 수(마지막) | 단위 41, DB 34, 데모 E2E 7, Supabase E2E 7 — 모두 통과 |
| 파일럿 가격 | 1인 9,900원 (식음료 별도), 결제 미연결 |
| 역(임시) | 성수·뚝섬·건대입구·왕십리·서울숲 (최대 2곳) |
| 시간대 | weekday-evening 19~21, weekend-lunch 12~14, weekend-afternoon 15~17, weekend-evening 18~20 (최대 2개, KST) |
| 날짜 | 내일부터 14일, 최대 6일 |
| 제한값 | 닉네임 12자, 한 줄 소개 80자, 자기소개 500자, 예산 상한 200,000원, 나이 만 20~45세 |
| 취미(임시 9) | 운동, 독서, 영화·드라마, 음악, 여행, 요리, 사진, 게임, 전시 관람 |
| 선호 장소(임시 6) | 맛집, 카페, 바, 전시·공연, 공원·산책, 팝업 스토어 |
| 신청 번호 | `CG-YYMMDD-XXXX` (Asia/Seoul) |
| 약관 버전 | `2026-11-draft` (`lib/consent.ts`) |
| 회차 seed | `pilot-1` (open, now ~ +56일) |
| localStorage 키 접두어 | `cheotgil.demo.v1.` |
| 개발 전용 기능 조건 | `DEV_TEST_LOGIN=1` 그리고 Supabase URL 호스트가 127.0.0.1/localhost |

## 9. People, terms & names
- **People:** 김민서(사용자, 저장소 소유자 ElseMinSeo).
- **Terms & nicknames:** 데모 모드 = local-demo(브라우저 저장); Supabase 모드 = 로그인 사용자별 DB; D01 = 하단 메뉴 변경 승인 항목; 단계 0~6 = ROADMAP 개발 단계.
- **Names in use:** `lib/repo/`(AppRepository, LocalDemoRepository, SupabaseRepository), `lib/apply/schema.ts`, `lib/apply/submit-server.ts`(submitForUser), `proxy.ts`, `lib/supabase/{browser,server,proxy-session}.ts`, `supabase/migrations/20261128000100~0500_*.sql`, 결정 기록 `docs/decisions/0001~0004`, 계획서 `docs/superpowers/plans/2026-11-28-stage2-supabase.md`.

## 10. Work state
| Item | Status | Version / location | Notes |
|---|---|---|---|
| MVP 0~1단계 + 새 시안 + noindex | final | main (#5, #6) | Vercel 공개 데모 |
| 2단계 로컬 Supabase | done, 미병합 | 작업 브랜치 `732940d` | main 병합 여부 사용자 결정 대기 |
| 코드 리뷰(code-review, security-review, web-design-guidelines) | 결과 보고 완료 | — | 수정 승인 대기 |
| 리뷰 '중요' 5건 + 로그인 자동입력 | not started | — | 아래 11번 |
| 3단계(운영자 소개·수락·일정/장소 합의) | not started | — | |

리뷰 '중요' 5건:
1. `/api/applications`가 약관 동의·계정 상태(active)를 확인하지 않음 (proxy matcher가 `api/` 제외)
2. 초안 자동저장(600ms) flush가 제출 직후 도착해 제출된 초안을 되살림 (`lib/repo/supabase.ts`)
3. 가능 일정이 날짜×시간대 전부 저장 → '토요일 평일 저녁' 같은 불가능 조합
4. 진행 중 신청이 있는데 새 키로 제출하면 성공처럼 보이고 새 답변 폐기·초안 잔존
5. 종료일 지난 회차도 status='open'이면 접수 (`end_at > now()` 미확인)
화면: 로그인 이메일 `autocomplete="email"`, 코드 `autocomplete="one-time-code"`, `spellCheck={false}` 없음.
미뤄둔 사소: idempotencyKey 길이 미검증·RPC 오류 일괄 500, admin 클라이언트를 인증 전에 생성, 422 후 직전 수정 유실, 동의 행 중복, 데모 모드에서 동의 화면 등 가드 없음, getUser 과다 호출, introducible_applications가 'offered' 제외(의도 확인), 비공개 장소 저장 시도로 존재 확인, 예산 입력 커서 튐, prefers-reduced-motion 미대응, hover 상태 없음, 홈 h1 없음, 테스트 공백(OTP 재전송·예전 localStorage 무시·비로그인 /appointments).

## 11. Next steps
1. **Next action:** 사용자 승인 후 리뷰 '중요' 5건 + 로그인 자동입력을 TDD로 수정(재현 테스트 먼저), 전체 테스트 5종 통과 후 작업 브랜치에 커밋·푸시.
2. 2단계를 PR로 main에 합칠지 사용자에게 확인(합쳐도 공개 데모는 local-demo라 변화 없음).
3. 3단계 계획서 작성(superpowers:writing-plans) → 실행.

## 12. Open questions ⚠️
- 리뷰 수정 진행 승인? (추천: 중요 5건 + 로그인 자동입력 지금, 나머지는 3단계 때)
- 2단계 main 병합 여부.
- Matching3·4 원본 시안 PNG (현재 3·4단계는 시안 10·11 사용).
- 취미 9종·선호 장소 6종·나이 만 20~45세 확정 여부, 2단계 항목 6개가 긴지.
- D01 하단 메뉴 변경 승인.
- 운영 Supabase 연결은 별도 승인 필요(할 일은 `docs/decisions/0004-supabase-stage2.md`).

## 13. Re-attach checklist
- [ ] 처음 업로드한 zip(START.md, ROADMAP.md, design/ 시안 11장): 원본 명세·로드맵. 저장소에는 없음
- [ ] 새 Figma 시안 PNG 4장(Matching1·2, main, Details_menu): 저장소에는 없음 (Figma 호출 한도 초과로 재조회 어려움)
- [ ] (선택) 이 파일 `handoff-cheot-gil.md`

---
<sub>Audit: 13/13 sections · 12 rules · 4 corrections · 40 data points · secrets removed: none found (local Supabase keys in repo are public CLI demo keys) · generated by active-memory</sub>

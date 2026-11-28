# CLAUDE.md

이 저장소는 **첫, 길 모바일 웹** 개발만을 위한 저장소입니다. 첫, 길과 관련 없는 작업은 여기서 하지 않습니다.
(이전 이름: masterpiece-website. 그 시절 정적 페이지는 모두 정리했습니다.)

Next.js 관련 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다. 이 버전의 Next.js는 학습 데이터와 다를 수 있으니,
코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 안내를 먼저 읽습니다.

## 사용자
- 전문 개발자가 아닙니다. 기술 용어는 쉽게 풀어서 설명하고, 선택지가 있으면 추천안을 함께 제시합니다.

## 소통
- 사용자와는 한국어로 대화합니다.
- 되돌리기 어려운 작업(파일 대량 삭제, 강제 푸시, 저장소 설정 변경)은 먼저 확인받습니다.

## 작업 방식
- 작업은 브랜치에서 하고, 사용자가 요청할 때만 PR을 만듭니다.
- PR은 `.github/pull_request_template.md` 양식을 따릅니다.
- 커밋 메시지는 무엇을 왜 바꿨는지 짧게 적습니다.
- 줄바꿈 형식 등 기존 파일의 형식을 함부로 바꾸지 않습니다.
- 사용자에게 보이는 변경은 `CHANGELOG.md`의 "아직 배포 안 됨" 항목에 적습니다.
- 기술 선택 같은 중요한 결정은 `docs/decisions/`에 기록합니다.

## 완료 전 확인
코드를 바꿨으면 커밋 전에 아래를 통과시킵니다.

```bash
npm run typecheck
npm test
npm run build && npm run test:e2e   # 화면을 바꿨을 때
npm run test:db                      # DB(마이그레이션·접근 규칙)를 바꿨을 때, 먼저 npm run db:start
npm run test:e2e:supabase            # 로그인·저장 흐름을 바꿨을 때
```

## 디자인 도구
- 화면 디자인을 점검하거나 다듬을 때는 `.claude/skills/`의 스킬(impeccable, web-design-guidelines 등)을 활용합니다.
- `.agents/`와 `resources/`는 외부에서 받은 자료입니다. 직접 고치지 않고, 앱 코드에서 가져다 쓰지 않습니다.
  (`tsconfig.json`에서 검사 대상 밖으로 빼 두었습니다.)

## 문서 위치
- 서비스 개요: `docs/overview.md`
- 시안 대비 차이, 미확정 가정값: `docs/design-notes.md`
- 결정 기록: `docs/decisions/`

## 프로젝트 메모
<!-- 진행 중인 목표, 결정 사항, 참고할 내용을 여기에 쌓아 갑니다. -->
- 현재 단계: MVP 단계 2 로컬 완료. 데모 모드(기본)와 Supabase 모드(`NEXT_PUBLIC_DATA_SOURCE=supabase`)가 함께 있음.
- 이 클라우드 환경에서 로컬 Supabase 이미지는 Docker Hub에서 받는다(`npm run db:start`에 설정됨). Docker 데몬이 꺼져 있으면 `dockerd &`.
- DB 변경은 `supabase/migrations/`에 새 파일로 추가하고, 접근 규칙 테스트를 `tests/db/`에 함께 쓴다.
- 다음 단계(3): 운영자 소개·수락·일정/장소 합의. 운영 Supabase 연결은 별도 승인 후.
- 하단 메뉴 변경안(홈·장소·내 약속·저장·프로필)은 D01 승인이 필요합니다. (`docs/design-notes.md`)

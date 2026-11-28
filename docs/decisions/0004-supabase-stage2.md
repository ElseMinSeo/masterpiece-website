# 0004. 단계 2: 로컬 Supabase 연결 방식

- 날짜: 2026-11-28
- 상태: 결정됨

## 상황
로그인 사용자별로 데이터를 저장하고, 두 계정이 서로의 비공개 정보를 볼 수 없게 해야 했다.
동시에 Vercel 공개 데모(브라우저 저장 방식)는 계속 동작해야 했다.

## 결정
- 데이터 저장 방식을 환경변수로 고른다: `NEXT_PUBLIC_DATA_SOURCE=local-demo`(기본) 또는 `supabase`.
  화면은 `AppRepository`만 쓰므로 둘 다 같은 화면으로 동작한다.
- 스키마와 접근 규칙(RLS)은 `supabase/migrations/`의 SQL로 관리한다. 모든 테이블은 기본 거부이고, 사용자는 본인 데이터만 본다.
- 신청은 서버 경로(`POST /api/applications`)가 세션으로 사용자를 확인하고 Zod로 다시 검증한 뒤, DB 함수 `submit_application`으로만 저장한다.
  이 함수는 서버 전용 키로만 부를 수 있어서, 브라우저에서 직접 불러 검증을 건너뛸 수 없다(최종 검토에서 발견해 수정).
  같은 키 재요청·동시 요청은 기존 신청을 돌려주고, 회차별 진행 중 신청은 1건이다(DB 유일 인덱스).
- 작성 중 신청서는 `application_drafts`(사용자당 1행, JSON)에 따로 둔다. 미완성 초안은 형식 검증을 할 수 없어서다.
- 운영자가 찾을 값(역·예산·나이·성별·흡연)은 컬럼에, 나머지 답변은 `answers`(JSON)에 둔다.
- 본인확인은 공급자 계약 전이라 개발 환경에서만 흉내 공급자를 쓴다. 운영에서는 모두 "본인확인 전"으로 남고,
  운영자용 소개 대상 조회(`introducible_applications`)는 본인확인 완료자만 돌려준다.
- 개발용 테스트 로그인·본인확인 흉내는 `DEV_TEST_LOGIN=1`이고 Supabase 주소가 로컬일 때만 켜진다.
- 로그인 메일에는 6자리 코드를 넣는 한국어 템플릿을 쓴다(기본 메일은 링크만 있음).
- 장소 화면은 아직 코드의 개발용 데이터를 읽는다. DB `places`는 같은 id로 seed되어 저장 기능의 기준이 된다.

## 운영 Supabase 연결 전에 할 일 (별도 승인)
1. Supabase 프로젝트 생성(지역·요금제 확인)과 `supabase db push`로 마이그레이션 적용
2. Vercel 환경변수: `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (`DEV_TEST_LOGIN`은 절대 설정하지 않음)
3. 로그인 메일: 발송용 SMTP 설정과 `supabase/templates/otp.html` 템플릿 등록, 보낸 사람 주소 확정
4. 약관·개인정보 처리방침 본문 확정 후 `lib/consent.ts`의 버전 올리기
5. 본인확인 업체 선정 후 `lib/verification/`에 실제 공급자 구현

## 결과
- 좋아지는 점: 접근 규칙이 DB에 있어 화면 코드가 실수해도 남의 데이터가 새지 않는다. 테스트(`npm run test:db`)로 확인한다.
- 감수할 점: 로컬 실행에 Docker가 필요하다. 데모 모드와 Supabase 모드 두 가지를 함께 유지해야 한다.

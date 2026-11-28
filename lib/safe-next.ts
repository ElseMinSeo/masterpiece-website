/**
 * 로그인 뒤 돌아갈 주소. 이 사이트 안의 경로만 허용하고, 다른 사이트로 보내는 주소는 홈으로 바꾼다.
 * 브라우저는 주소를 해석할 때 탭·줄바꿈을 지우므로("/\t/evil" → "//evil") 공백·제어 문자·역슬래시는 모두 거절한다.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/home";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f\\]/.test(raw)) return "/home";
  return raw;
}

/** 로그인 뒤 돌아갈 주소. 이 사이트 안의 경로만 허용하고, 다른 사이트로 보내는 주소는 홈으로 바꾼다. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/home";
  return raw;
}

import { isLocalSupabaseUrl } from "./env";

/** 개발 전용 기능(테스트 로그인, 본인확인 흉내)은 플래그와 로컬 Supabase 주소가 모두 있을 때만 켠다 */
export function devLoginAllowed(env: { DEV_TEST_LOGIN?: string; url: string }): boolean {
  return env.DEV_TEST_LOGIN === "1" && isLocalSupabaseUrl(env.url);
}

export function devToolsEnabled(): boolean {
  return devLoginAllowed({ DEV_TEST_LOGIN: process.env.DEV_TEST_LOGIN, url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "" });
}

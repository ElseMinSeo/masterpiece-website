import { devLoginAllowed } from "@/lib/dev-login";
import { mockVerificationProvider } from "./mock";
import type { VerificationProvider } from "./types";

/**
 * 본인확인 공급자. 공급자 계약 전이라 개발 환경(플래그 + 로컬 Supabase)에서만 흉내 공급자를 쓰고,
 * 그 밖의 환경에서는 null을 돌려 모든 사용자가 '본인확인 전'으로 남는다.
 */
export function getVerificationProvider(env: { DEV_TEST_LOGIN?: string; url: string }): VerificationProvider | null {
  return devLoginAllowed(env) ? mockVerificationProvider : null;
}

export type { VerificationProvider } from "./types";

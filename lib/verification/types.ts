/** 본인확인 공급자 계약. 실제 공급자(계약 후)와 개발용 흉내 공급자가 같은 모양을 따른다. */
export interface VerificationProvider {
  start(userId: string): Promise<{ status: "pending"; ref: string }>;
  complete(ref: string, outcome: "verified" | "failed"): Promise<{ status: "verified" | "unverified" }>;
}

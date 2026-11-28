import type { VerificationProvider } from "./types";

/** 개발 전용 흉내 공급자. 실제로 아무것도 확인하지 않는다. */
export const mockVerificationProvider: VerificationProvider = {
  async start(userId) {
    return { status: "pending", ref: `mock:${userId}:${Date.now()}` };
  },
  async complete(_ref, outcome) {
    return { status: outcome === "verified" ? "verified" : "unverified" };
  },
};

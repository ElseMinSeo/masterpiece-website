import { describe, expect, it } from "vitest";
import { hasRequiredConsents, POLICY_VERSION } from "@/lib/consent";

describe("필수 동의 확인", () => {
  it("현재 버전의 이용약관과 개인정보 동의가 모두 있어야 한다", () => {
    expect(hasRequiredConsents([
      { purpose: "terms", policy_version: POLICY_VERSION },
      { purpose: "privacy", policy_version: POLICY_VERSION },
    ])).toBe(true);
    expect(hasRequiredConsents([{ purpose: "terms", policy_version: POLICY_VERSION }])).toBe(false);
  });

  it("약관 버전이 바뀌면 예전 동의로는 통과하지 못한다 (다시 동의 받기)", () => {
    expect(hasRequiredConsents([
      { purpose: "terms", policy_version: "2025-old" },
      { purpose: "privacy", policy_version: "2025-old" },
    ])).toBe(false);
  });
});

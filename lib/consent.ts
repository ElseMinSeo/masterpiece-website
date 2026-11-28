/** 현재 약관 버전. 약관 본문이 확정되면 올리고, 올리면 모든 사용자에게 다시 동의를 받는다. */
export const POLICY_VERSION = "2026-11-draft";
export const REQUIRED_CONSENTS = ["terms", "privacy"] as const;

/** 철회되지 않은 동의 기록 중 현재 버전의 필수 동의가 모두 있는지 */
export function hasRequiredConsents(rows: { purpose: string; policy_version: string }[], version: string = POLICY_VERSION): boolean {
  const have = new Set(rows.filter((r) => r.policy_version === version).map((r) => r.purpose));
  return REQUIRED_CONSENTS.every((p) => have.has(p));
}

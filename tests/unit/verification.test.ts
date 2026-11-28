import { describe, expect, it } from "vitest";
import { getVerificationProvider } from "@/lib/verification";

describe("본인확인 공급자 선택", () => {
  it("운영 주소나 플래그가 없으면 공급자가 없다 (미검증 상태 유지)", () => {
    expect(getVerificationProvider({ DEV_TEST_LOGIN: "1", url: "https://abc.supabase.co" })).toBeNull();
    expect(getVerificationProvider({ DEV_TEST_LOGIN: undefined, url: "http://127.0.0.1:54321" })).toBeNull();
  });

  it("로컬 개발에서는 흉내 공급자가 확인 결과를 돌려준다", async () => {
    const p = getVerificationProvider({ DEV_TEST_LOGIN: "1", url: "http://127.0.0.1:54321" });
    expect(p).not.toBeNull();
    const started = await p!.start("user-1");
    expect(started.status).toBe("pending");
    expect(started.ref).toMatch(/^mock:/);
    expect((await p!.complete(started.ref, "verified")).status).toBe("verified");
    expect((await p!.complete(started.ref, "failed")).status).toBe("unverified");
  });
});

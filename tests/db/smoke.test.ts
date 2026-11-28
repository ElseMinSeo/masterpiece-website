import { describe, expect, it } from "vitest";
import { makeUser } from "./helpers";

describe("로컬 Supabase 연결", () => {
  it("테스트 사용자를 만들고 그 사용자로 로그인한다", async () => {
    const a = await makeUser("smoke");
    const { data } = await a.client.auth.getUser();
    expect(data.user?.id).toBe(a.id);
  });
});

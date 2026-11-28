import { describe, expect, it } from "vitest";
import { submitForUser } from "@/lib/apply/submit-server";
import { NOW, validDraft } from "../unit/helpers";
import { anon, makeUser } from "./helpers";

describe("서버 신청 제출", () => {
  it("로그인하지 않으면 401", async () => {
    const res = await submitForUser(anon(), validDraft("r-0"), NOW);
    expect(res.status).toBe(401);
  });

  it("검증에 실패하면 422와 필드 오류를 돌려주고 저장하지 않는다", async () => {
    const u = await makeUser("rp-a");
    const res = await submitForUser(u.client, { ...validDraft("r-1"), intro: "   " }, NOW);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ errors: { intro: expect.stringContaining("한 줄 소개") } });
    expect((await u.client.from("applications").select("id")).data).toEqual([]);
  });

  it("같은 초안을 두 번 보내면 같은 신청 번호이고 두 번째는 중복 표시", async () => {
    const u = await makeUser("rp-b");
    const first = await submitForUser(u.client, validDraft("r-2"), NOW);
    const second = await submitForUser(u.client, validDraft("r-2"), NOW);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    if (first.status !== 200 || second.status !== 200) return;
    expect(second.body.application.number).toBe(first.body.application.number);
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(first.body.application.data.intro).toBe("조용한 카페 데이트를 좋아해요");
  });

  it("형식이 깨진 요청 본문은 422", async () => {
    const u = await makeUser("rp-c");
    expect((await submitForUser(u.client, "garbage", NOW)).status).toBe(422);
    expect((await submitForUser(u.client, { intro: "키 없음" }, NOW)).status).toBe(422);
  });
});

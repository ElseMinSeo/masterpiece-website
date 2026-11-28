import { describe, expect, it } from "vitest";
import { submitForUser } from "@/lib/apply/submit-server";
import { NOW, validDraft } from "../unit/helpers";
import { admin, anon, makeUser } from "./helpers";

describe("서버 신청 제출", () => {
  it("로그인하지 않으면 401", async () => {
    const res = await submitForUser(anon(), admin(), validDraft("r-0"), NOW);
    expect(res.status).toBe(401);
  });

  it("검증에 실패하면 422와 필드 오류를 돌려주고 저장하지 않는다", async () => {
    const u = await makeUser("rp-a");
    const res = await submitForUser(u.client, admin(), { ...validDraft("r-1"), intro: "   " }, NOW);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ errors: { intro: expect.stringContaining("한 줄 소개") } });
    expect((await u.client.from("applications").select("id")).data).toEqual([]);
  });

  it("같은 초안을 두 번 보내면 같은 신청 번호이고 두 번째는 중복 표시", async () => {
    const u = await makeUser("rp-b");
    const first = await submitForUser(u.client, admin(), validDraft("r-2"), NOW);
    const second = await submitForUser(u.client, admin(), validDraft("r-2"), NOW);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    if (first.status !== 200 || second.status !== 200) return;
    expect(second.body.application.number).toBe(first.body.application.number);
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(first.body.application.data.intro).toBe("조용한 카페 데이트를 좋아해요");
  });

  it("필수 약관에 동의하지 않았으면 403이고 신청이 생기지 않는다", async () => {
    const u = await makeUser("rp-noconsent", { consent: false });
    const res = await submitForUser(u.client, admin(), validDraft("r-nc"), NOW);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errors: { _form: expect.stringContaining("약관") } });
    expect((await u.client.from("applications").select("id")).data).toEqual([]);
  });

  it("이용이 정지된 계정은 403이고 신청이 생기지 않는다", async () => {
    const u = await makeUser("rp-suspended");
    await admin().from("profiles").update({ account_status: "suspended" }).eq("id", u.id);
    const res = await submitForUser(u.client, admin(), validDraft("r-sus"), NOW);
    expect(res.status).toBe(403);
    expect((await u.client.from("applications").select("id")).data).toEqual([]);
  });

  it("진행 중 신청이 있는데 새 신청서를 보내면 409로 알리고 기존 신청은 그대로다", async () => {
    const u = await makeUser("rp-active");
    const first = await submitForUser(u.client, admin(), validDraft("r-a1"), NOW);
    expect(first.status).toBe(200);
    const second = await submitForUser(u.client, admin(), { ...validDraft("r-a2"), intro: "새로 쓴 소개" }, NOW);
    expect(second.status).toBe(409);
    if (first.status !== 200 || second.status !== 409) return;
    expect(second.body.activeNumber).toBe(first.body.application.number);
    expect(second.body.errors._form).toContain("진행 중인 신청");
    const { data } = await u.client.from("applications").select("answers");
    expect(data).toHaveLength(1);
    expect((data![0]!.answers as { intro: string }).intro).toBe("조용한 카페 데이트를 좋아해요");
  });

  it("형식이 깨진 요청 본문은 422", async () => {
    const u = await makeUser("rp-c");
    expect((await submitForUser(u.client, admin(), "garbage", NOW)).status).toBe(422);
    expect((await submitForUser(u.client, admin(), { intro: "키 없음" }, NOW)).status).toBe(422);
  });
});

describe("운영자 계정의 '내' 데이터", () => {
  it("운영자도 자기 프로필·본인확인 상태·신청만 본다", async () => {
    const { SupabaseRepository } = await import("@/lib/repo/supabase");
    const other = await makeUser("rp-other");
    await submitForUser(other.client, admin(), validDraft("other-1"), NOW);
    const op = await makeUser("rp-op");
    await admin().from("admin_roles").insert({ user_id: op.id, role: "operator" });
    await op.client.from("profiles").update({ nickname: "운영자" }).eq("id", op.id);

    const repo = new SupabaseRepository(op.client);
    expect((await repo.getProfile()).nickname).toBe("운영자");
    expect(await repo.getVerificationStatus()).toBe("unverified");
    expect(await repo.listApplications()).toEqual([]);

    const mine = await submitForUser(op.client, admin(), validDraft("other-1"), NOW);
    expect(mine.status).toBe(200);
    if (mine.status === 200) expect(mine.body.duplicate).toBe(false); // 남의 같은 키를 내 것으로 착각하지 않음
  });
});

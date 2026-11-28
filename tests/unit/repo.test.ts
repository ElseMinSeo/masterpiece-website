import { describe, expect, it } from "vitest";
import { LocalDemoRepository, makeApplicationNumber } from "@/lib/repo/local";
import { memStore, NOW, validDraft } from "./helpers";

const repo = () => {
  const store = memStore();
  return { store, r: new LocalDemoRepository(store, () => NOW) };
};

describe("로컬 데모 저장소", () => {
  it("초안 저장 후 새 인스턴스(새로고침)에서 복원된다", async () => {
    const { store, r } = repo();
    await r.saveDraft({ ...validDraft(), intro: "새로고침 테스트" });
    const again = new LocalDemoRepository(store, () => NOW);
    expect((await again.getDraft())?.intro).toBe("새로고침 테스트");
  });

  it("같은 초안을 동시에 여러 번 제출해도 신청은 1건", async () => {
    const { r } = repo();
    const d = validDraft();
    const results = await Promise.all([r.submitApplication(d), r.submitApplication(d), r.submitApplication(d)]);
    const apps = await r.listApplications();
    expect(apps).toHaveLength(1);
    expect(new Set(results.map((x) => x.ok && x.application.id)).size).toBe(1);
  });

  it("순차로 다시 제출해도(새로고침 후 재전송) 기존 신청을 돌려준다", async () => {
    const { r } = repo();
    const first = await r.submitApplication(validDraft("k1"));
    const second = await r.submitApplication(validDraft("k1"));
    expect(second.ok && second.duplicate).toBe(true);
    expect(first.ok && second.ok && first.application.number === second.application.number).toBe(true);
    expect(await r.listApplications()).toHaveLength(1);
  });

  it("진행 중인 신청이 있으면 다른 초안으로도 새 신청이 생기지 않는다", async () => {
    const { r } = repo();
    const first = await r.submitApplication(validDraft("k1"));
    const second = await r.submitApplication({ ...validDraft("k2"), intro: "새로 쓴 소개" });
    expect(await r.listApplications()).toHaveLength(1);
    // 새 답변은 저장되지 않으므로 성공처럼 보이면 안 된다
    expect(second.ok).toBe(false);
    if (first.ok && !second.ok) expect(second.errors._form).toContain(first.application.number);
  });

  it("잘못된 초안은 저장하지 않고 필드 오류를 돌려준다", async () => {
    const { r } = repo();
    const res = await r.submitApplication({ ...validDraft(), intro: " ", budgetMin: 90000, budgetMax: 10000 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors)).toEqual(expect.arrayContaining(["intro", "budgetMax"]));
    expect(await r.listApplications()).toHaveLength(0);
  });

  it("제출 성공 시 초안을 지우고 상태는 submitted", async () => {
    const { r } = repo();
    await r.saveDraft(validDraft());
    const res = await r.submitApplication(validDraft());
    expect(res.ok && res.application.status).toBe("submitted");
    expect(await r.getDraft()).toBeNull();
  });

  it("저장 토글과 존재하지 않는 장소 거절", async () => {
    const { r } = repo();
    expect(await r.setBookmark("dev-001", true)).toEqual(["dev-001"]);
    expect(await r.setBookmark("dev-001", true)).toEqual(["dev-001"]);
    expect(await r.setBookmark("dev-001", false)).toEqual([]);
    await expect(r.setBookmark("nope", true)).rejects.toThrow();
  });

  it("신청 번호 형식", () => {
    expect(makeApplicationNumber(NOW, () => 0.5)).toMatch(/^CG-261127-[0-9A-Z]{4}$/);
  });
});

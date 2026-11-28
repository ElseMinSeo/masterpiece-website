import { beforeAll, describe, expect, it } from "vitest";
import { anon, makeUser, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;
beforeAll(async () => {
  a = await makeUser("pl-a");
  b = await makeUser("pl-b");
});

describe("장소·저장·회차", () => {
  it("로그인하지 않아도 공개된 장소 8곳을 볼 수 있다", async () => {
    const { data } = await anon().from("places").select("id").order("id");
    expect(data?.map((p) => p.id)).toEqual(["dev-001", "dev-002", "dev-003", "dev-004", "dev-005", "dev-006", "dev-007", "dev-008"]);
  });

  it("열린 파일럿 회차가 있다", async () => {
    const { data } = await a.client.from("cohorts").select("code, status").eq("status", "open");
    expect(data?.map((c) => c.code)).toContain("pilot-1");
  });

  it("A의 저장 목록은 B에게 보이지 않는다", async () => {
    expect((await a.client.from("bookmarks").insert({ user_id: a.id, place_id: "dev-001" })).error).toBeNull();
    const mine = await a.client.from("bookmarks").select("place_id");
    expect(mine.data?.map((r) => r.place_id)).toEqual(["dev-001"]);
    const theirs = await b.client.from("bookmarks").select("place_id").eq("user_id", a.id);
    expect(theirs.data).toEqual([]);
  });

  it("다른 사람 이름으로 저장할 수 없고, 없는 장소는 저장할 수 없다", async () => {
    expect((await a.client.from("bookmarks").insert({ user_id: b.id, place_id: "dev-002" })).error).not.toBeNull();
    expect((await a.client.from("bookmarks").insert({ user_id: a.id, place_id: "nope" })).error).not.toBeNull();
  });

  it("저장을 취소할 수 있다", async () => {
    await a.client.from("bookmarks").delete().eq("place_id", "dev-001");
    expect((await a.client.from("bookmarks").select("place_id")).data).toEqual([]);
  });
});

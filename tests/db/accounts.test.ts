import { beforeAll, describe, expect, it } from "vitest";
import { admin, makeUser, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await makeUser("acc-a");
  b = await makeUser("acc-b");
});

describe("계정 테이블과 접근 규칙", () => {
  it("가입하면 프로필과 비공개 프로필이 자동으로 생기고 본인확인 전 상태다", async () => {
    const { data: p } = await a.client.from("profiles").select("id, nickname").eq("id", a.id).single();
    expect(p?.id).toBe(a.id);
    const { data: pp } = await a.client.from("private_profiles").select("verification_status").eq("user_id", a.id).single();
    expect(pp?.verification_status).toBe("unverified");
  });

  it("A는 B의 프로필·비공개 프로필·동의 내역을 볼 수 없다", async () => {
    await b.client.from("consents").insert({ user_id: b.id, purpose: "terms", policy_version: "2026-11-draft" });
    const p = await a.client.from("profiles").select("id").eq("id", b.id);
    const pp = await a.client.from("private_profiles").select("user_id").eq("user_id", b.id);
    const c = await a.client.from("consents").select("id").eq("user_id", b.id);
    expect(p.data).toEqual([]);
    expect(pp.data).toEqual([]);
    expect(c.data).toEqual([]);
  });

  it("본인은 닉네임만 바꿀 수 있고 본인확인 상태는 바꿀 수 없다", async () => {
    const ok = await a.client.from("profiles").update({ nickname: "봄바람" }).eq("id", a.id).select("nickname");
    expect(ok.data?.[0]?.nickname).toBe("봄바람");
    const bad = await a.client.from("profiles").update({ account_status: "suspended" }).eq("id", a.id);
    expect(bad.error).not.toBeNull();
    await a.client.from("private_profiles").update({ verification_status: "verified" }).eq("user_id", a.id);
    const { data } = await admin().from("private_profiles").select("verification_status").eq("user_id", a.id).single();
    expect(data?.verification_status).toBe("unverified");
  });

  it("닉네임 길이 규칙(1~12자)을 DB도 지킨다", async () => {
    const bad = await a.client.from("profiles").update({ nickname: "가".repeat(13) }).eq("id", a.id);
    expect(bad.error).not.toBeNull();
  });

  it("사용자는 운영자 권한을 스스로 줄 수 없다", async () => {
    const res = await a.client.from("admin_roles").insert({ user_id: a.id, role: "operator" });
    expect(res.error).not.toBeNull();
    const { data } = await a.client.rpc("is_admin");
    expect(data).toBe(false);
  });

  it("다른 사람 이름으로 동의를 기록할 수 없다", async () => {
    const res = await a.client.from("consents").insert({ user_id: b.id, purpose: "terms", policy_version: "2026-11-draft" });
    expect(res.error).not.toBeNull();
  });

  it("운영자는 다른 사용자의 프로필과 본인확인 상태를 볼 수 있다", async () => {
    const op = await makeUser("acc-op");
    const grant = await admin().from("admin_roles").insert({ user_id: op.id, role: "operator" });
    expect(grant.error).toBeNull();
    const { data } = await op.client.from("private_profiles").select("user_id").in("user_id", [a.id, b.id]);
    expect(data).toHaveLength(2);
    expect((await op.client.rpc("is_admin")).data).toBe(true);
  });
});

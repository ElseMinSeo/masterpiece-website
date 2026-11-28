import { beforeAll, describe, expect, it } from "vitest";
import { parseSubmission } from "@/lib/apply/schema";
import { NOW, validDraft } from "../unit/helpers";
import { admin, makeUser, type TestUser } from "./helpers";

function payload(overrides: Record<string, unknown> = {}) {
  const r = parseSubmission(validDraft(), NOW);
  if (!r.ok) throw new Error("fixture invalid");
  return { ...r.value, ...overrides };
}

const submit = (u: TestUser, key: string, p = payload()) =>
  u.client.rpc("submit_application", { p_idempotency_key: key, p_payload: p });

let a: TestUser;
let b: TestUser;
beforeAll(async () => {
  a = await makeUser("ap-a");
  b = await makeUser("ap-b");
});

describe("신청 제출 함수", () => {
  it("같은 키로 동시에 3번 제출해도 신청은 1건이고 모두 같은 신청을 돌려받는다", async () => {
    const results = await Promise.all([submit(a, "k-1"), submit(a, "k-1"), submit(a, "k-1")]);
    for (const r of results) expect(r.error).toBeNull();
    expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
    expect(results[0]!.data.number).toMatch(/^CG-\d{6}-[0-9A-Z]{4}$/);
    expect(results[0]!.data.status).toBe("submitted");
    const { data } = await a.client.from("applications").select("id");
    expect(data).toHaveLength(1);
  });

  it("가능 일정은 날짜×시간대마다 한 줄이고 서울 시각으로 저장된다", async () => {
    const { data: app } = await a.client.from("applications").select("id").single();
    const { data: rows } = await a.client.from("availability").select("slot_date, slot_id, starts_at, ends_at").eq("application_id", app!.id).order("slot_date");
    const p = payload();
    expect(rows).toHaveLength(p.dates.length * p.timeSlots.length);
    expect(rows![0]!.slot_id).toBe("weekday-evening");
    expect(new Date(rows![0]!.starts_at).toISOString()).toBe(`${p.dates[0]}T10:00:00.000Z`);
    expect(new Date(rows![0]!.ends_at).toISOString()).toBe(`${p.dates[0]}T12:00:00.000Z`);
  });

  it("다른 키로 동시에 제출해도 진행 중인 신청은 1건뿐이다", async () => {
    const c = await makeUser("ap-c");
    const results = await Promise.all([submit(c, "x-1"), submit(c, "x-2"), submit(c, "x-3")]);
    for (const r of results) expect(r.error).toBeNull();
    const { data } = await c.client.from("applications").select("id");
    expect(data).toHaveLength(1);
  });

  it("B는 A의 신청·가능 일정·초안을 볼 수 없다", async () => {
    await a.client.from("application_drafts").upsert({ user_id: a.id, data: { intro: "비밀 초안" } });
    expect((await b.client.from("applications").select("id").eq("user_id", a.id)).data).toEqual([]);
    expect((await b.client.from("availability").select("id")).data).toEqual([]);
    expect((await b.client.from("application_drafts").select("user_id").eq("user_id", a.id)).data).toEqual([]);
  });

  it("본인 초안은 저장·조회되고, 제출에 성공하면 초안이 지워진다", async () => {
    const d = await makeUser("ap-d");
    expect((await d.client.from("application_drafts").upsert({ user_id: d.id, data: { intro: "작성 중" } })).error).toBeNull();
    expect((await d.client.from("application_drafts").select("data").single()).data?.data).toEqual({ intro: "작성 중" });
    await submit(d, "d-1");
    expect((await d.client.from("application_drafts").select("user_id")).data).toEqual([]);
  });

  it("신청 테이블에 직접 쓰거나 고칠 수 없다", async () => {
    const ins = await b.client.from("applications").insert({ user_id: b.id, idempotency_key: "z", status: "submitted" });
    expect(ins.error).not.toBeNull();
    const { data: app } = await a.client.from("applications").select("id").single();
    await a.client.from("applications").update({ status: "offered" }).eq("id", app!.id);
    expect((await a.client.from("applications").select("status").single()).data?.status).toBe("submitted");
  });

  it("역 3곳, 예산 역전, 모르는 시간대는 DB도 거절한다", async () => {
    const e = await makeUser("ap-e");
    expect((await submit(e, "e-1", payload({ stations: ["성수", "뚝섬", "왕십리"] }))).error).not.toBeNull();
    expect((await submit(e, "e-2", payload({ budgetMin: 50000, budgetMax: 10000 }))).error).not.toBeNull();
    expect((await submit(e, "e-3", payload({ timeSlots: ["midnight"] }))).error).not.toBeNull();
    expect((await e.client.from("applications").select("id")).data).toEqual([]);
  });

  it("로그인하지 않으면 제출할 수 없다", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const guest = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!);
    expect((await guest.rpc("submit_application", { p_idempotency_key: "g", p_payload: payload() })).error).not.toBeNull();
  });
});

describe("운영자 소개 대상 조회", () => {
  it("본인확인을 마친 사람의 신청만 돌려주고, 일반 사용자는 호출할 수 없다", async () => {
    const v = await makeUser("ap-verified");
    await admin().from("private_profiles").update({ verification_status: "verified", verified_at: new Date().toISOString() }).eq("user_id", v.id);
    await submit(v, "v-1");
    const op = await makeUser("ap-op");
    await admin().from("admin_roles").insert({ user_id: op.id, role: "operator" });
    const { data: cohort } = await admin().from("cohorts").select("id").eq("code", "pilot-1").single();
    const { data, error } = await op.client.rpc("introducible_applications", { p_cohort: cohort!.id });
    expect(error).toBeNull();
    const owners = (data as { user_id: string }[]).map((r) => r.user_id);
    expect(owners).toContain(v.id);
    expect(owners).not.toContain(a.id); // A는 본인확인 전
    expect((await a.client.rpc("introducible_applications", { p_cohort: cohort!.id })).error).not.toBeNull();
  });
});

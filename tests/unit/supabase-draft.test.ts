import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRepository } from "@/lib/repo/supabase";
import { validDraft } from "./helpers";

/** 로그인 확인이 느린 상황을 흉내 내는 가짜 DB. 일어난 일을 순서대로 기록한다. */
function fakeDb(events: string[]) {
  let release!: () => void;
  const slowUser = new Promise<void>((r) => (release = r));
  const db = {
    auth: {
      getUser: async () => {
        await slowUser;
        return { data: { user: { id: "u1", email: null } } };
      },
    },
    from: () => ({
      upsert: async () => {
        events.push("draft-upsert");
        return { error: null };
      },
    }),
  };
  return { db: db as unknown as SupabaseClient, release };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Supabase 저장소: 초안 자동저장과 제출", () => {
  it("자동저장이 진행 중일 때 제출하면, 저장이 끝난 뒤에 제출해 초안이 되살아나지 않는다", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const { db, release } = fakeDb(events);
    vi.stubGlobal("fetch", async () => {
      events.push("submit");
      return new Response(JSON.stringify({ errors: { _form: "x" } }), { status: 422 });
    });
    const repo = new SupabaseRepository(db);

    await repo.saveDraft(validDraft());
    await vi.advanceTimersByTimeAsync(700); // 자동저장 시작 (로그인 확인 대기 중)
    const submitting = repo.submitApplication(validDraft());
    release();
    await submitting;
    await vi.runAllTimersAsync();

    // 서버는 제출 성공 시 초안을 지운다. 그 뒤에 초안 저장이 도착하면 제출한 초안이 되살아난다.
    expect(events.at(-1)).toBe("submit");
  });
});

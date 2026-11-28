import { afterEach, describe, expect, it, vi } from "vitest";
import { dataSource, isLocalSupabaseUrl, supabasePublicEnv } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("환경 설정", () => {
  it("로컬 Supabase 주소만 로컬로 판단한다", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://abc.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("not a url")).toBe(false);
  });

  it("데이터 소스 기본값은 local-demo", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "");
    expect(dataSource()).toBe("local-demo");
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "supabase");
    expect(dataSource()).toBe("supabase");
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "something-else");
    expect(dataSource()).toBe("local-demo");
  });

  it("Supabase 공개 설정이 없으면 오류", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => supabasePublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

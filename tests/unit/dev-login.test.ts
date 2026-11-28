import { describe, expect, it } from "vitest";
import { devLoginAllowed } from "@/lib/dev-login";

describe("개발 전용 테스트 로그인 허용 조건", () => {
  it("플래그가 없으면 막는다", () => {
    expect(devLoginAllowed({ DEV_TEST_LOGIN: undefined, url: "http://127.0.0.1:54321" })).toBe(false);
    expect(devLoginAllowed({ DEV_TEST_LOGIN: "0", url: "http://127.0.0.1:54321" })).toBe(false);
  });
  it("플래그가 있어도 로컬 Supabase가 아니면 막는다", () => {
    expect(devLoginAllowed({ DEV_TEST_LOGIN: "1", url: "https://abc.supabase.co" })).toBe(false);
  });
  it("플래그와 로컬 주소가 모두 있을 때만 허용한다", () => {
    expect(devLoginAllowed({ DEV_TEST_LOGIN: "1", url: "http://127.0.0.1:54321" })).toBe(true);
    expect(devLoginAllowed({ DEV_TEST_LOGIN: "1", url: "http://localhost:54321" })).toBe(true);
  });
});

import { safeNext } from "@/lib/safe-next";

describe("로그인 후 돌아갈 주소", () => {
  it("사이트 안 경로만 허용한다", () => {
    expect(safeNext("/apply/1")).toBe("/apply/1");
    expect(safeNext(null)).toBe("/home");
    expect(safeNext("https://evil.example")).toBe("/home");
    expect(safeNext("//evil.example")).toBe("/home");
    expect(safeNext("/\\evil.example")).toBe("/home");
  });

  it("브라우저가 지우는 제어 문자로 다른 사이트로 빠지는 주소를 막는다", () => {
    expect(safeNext("/\t/evil.example")).toBe("/home");
    expect(safeNext("/\n/evil.example")).toBe("/home");
    expect(safeNext("/\r/evil.example")).toBe("/home");
    expect(safeNext("/ /evil.example")).toBe("/home");
    expect(safeNext("/apply?step=1#top")).toBe("/apply?step=1#top");
  });
});

import { describe, expect, it } from "vitest";
import { availabilityPairs, slotFitsDate } from "@/lib/apply/dates";
import { validateStep } from "@/lib/apply/schema";
import { MON, NOW, SAT, SUN, TUE, validDraft } from "./helpers";

describe("가능 일정: 날짜와 시간대 조합", () => {
  it("평일 저녁은 월~금, 주말 시간대는 토·일에만 맞는다", () => {
    expect(slotFitsDate("weekday-evening", MON)).toBe(true);
    expect(slotFitsDate("weekday-evening", SAT)).toBe(false);
    expect(slotFitsDate("weekend-lunch", SUN)).toBe(true);
    expect(slotFitsDate("weekend-lunch", TUE)).toBe(false);
  });

  it("저장할 일정은 맞는 조합만 만든다 (토요일 평일 저녁 같은 조합 없음)", () => {
    expect(availabilityPairs([MON, SAT], ["weekday-evening", "weekend-lunch"])).toEqual([
      { date: MON, slotId: "weekday-evening" },
      { date: SAT, slotId: "weekend-lunch" },
    ]);
  });

  it("고른 날짜에 맞는 시간대가 하나도 없으면 날짜 칸에 오류", () => {
    const e = validateStep(5, { ...validDraft(), dates: [MON, SAT], timeSlots: ["weekday-evening"] }, NOW);
    expect(e.dates).toMatch(/주말/);
  });

  it("고른 시간대에 맞는 날짜가 하나도 없으면 시간대 칸에 오류", () => {
    const e = validateStep(5, { ...validDraft(), dates: [MON, TUE], timeSlots: ["weekday-evening", "weekend-lunch"] }, NOW);
    expect(e.timeSlots).toMatch(/주말/);
  });

  it("평일·주말을 섞어도 각각 맞는 시간대가 있으면 통과", () => {
    const e = validateStep(5, { ...validDraft(), dates: [MON, SAT], timeSlots: ["weekday-evening", "weekend-lunch"] }, NOW);
    expect(e).toEqual({});
  });
});

import { PLAN_DAYS } from "./options";

/** Asia/Seoul 기준 YYYY-MM-DD */
export function seoulDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 내일부터 PLAN_DAYS일(2주) 동안의 날짜 목록 */
export function upcomingDates(now: Date = new Date(), days: number = PLAN_DAYS): string[] {
  const out: string[] = [];
  for (let i = 1; i <= days; i++) {
    out.push(seoulDateString(new Date(now.getTime() + i * 86_400_000)));
  }
  return out;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD의 요일 (0=일 ~ 6=토) */
function dayOfWeek(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export function isWeekend(ymd: string): boolean {
  const wd = dayOfWeek(ymd);
  return wd === 0 || wd === 6;
}

export function formatDateChip(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}/${d} (${WEEKDAYS[dayOfWeek(ymd)]})`;
}

/** 평일 저녁은 월~금, 주말 시간대는 토·일에만 맞는다 (공휴일은 아직 고려하지 않음) */
export function slotFitsDate(slotId: string, ymd: string): boolean {
  return slotId.startsWith("weekend-") ? isWeekend(ymd) : !isWeekend(ymd);
}

/** 저장할 가능 일정: 고른 날짜×시간대 중 맞는 조합만 */
export function availabilityPairs(dates: readonly string[], slotIds: readonly string[]): { date: string; slotId: string }[] {
  return dates.flatMap((date) => slotIds.filter((slotId) => slotFitsDate(slotId, date)).map((slotId) => ({ date, slotId })));
}

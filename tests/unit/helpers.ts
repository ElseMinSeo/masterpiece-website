import { emptyDraft, type ApplicationDraft } from "@/lib/apply/schema";
import type { KeyValueStore } from "@/lib/repo/local";

export const NOW = new Date("2026-11-27T03:00:00Z"); // 서울 2026-11-27 12:00

export function memStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

// NOW 기준 앞으로 2주 안의 날짜 (2026-11-27은 금요일)
export const SAT = "2026-11-28";
export const SUN = "2026-11-29";
export const MON = "2026-11-30";
export const TUE = "2026-12-01";

export function validDraft(key = "key-1"): ApplicationDraft {
  return {
    ...emptyDraft(key),
    nickname: "봄바람", birthYear: 1996, gender: "여성", bio: "",
    hobbies: ["독서"], preferredPlaces: ["카페"], moods: ["조용한"], foods: ["한식"], avoidPlaces: [], smoking: "비흡연",
    personalities: ["다정한", "솔직한"], contactStyles: ["적당히"], intro: "조용한 카페 데이트를 좋아해요",
    ageMin: 27, ageMax: 34, partnerPersonalities: ["다정한"], tempo: "일정 확인 후 결정",
    stations: ["성수", "뚝섬"], dates: [MON, TUE], timeSlots: ["weekday-evening"],
    budgetMin: 20000, budgetMax: 40000, confirmed: true,
  };
}

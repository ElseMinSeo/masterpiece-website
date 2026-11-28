import { z } from "zod";
import {
  AGE_MAX, AGE_MIN, AVOID_PLACES, BIO_MAX, BUDGET_MAX, CONTACT_STYLES, FOODS, GENDERS, HOBBIES,
  INTRO_MAX, MAX_DATES, MAX_STATIONS, MAX_TIME_SLOTS, MOODS, NICKNAME_MAX, PERSONALITIES,
  PREFERRED_PLACES, SMOKING, STATIONS, TEMPOS, TIME_SLOTS,
} from "./options";
import { seoulDateString, slotFitsDate, upcomingDates } from "./dates";

export interface ApplicationDraft {
  // 1단계 기본 정보
  nickname: string;
  birthYear: number | null;
  gender: string;
  bio: string;
  // 2단계 취향
  hobbies: string[];
  preferredPlaces: string[];
  moods: string[];
  foods: string[];
  avoidPlaces: string[];
  smoking: string;
  // 3단계 나
  personalities: string[];
  contactStyles: string[];
  intro: string;
  // 4단계 상대
  ageMin: number;
  ageMax: number;
  partnerPersonalities: string[];
  tempo: string;
  // 제출 전 확인
  stations: string[];
  dates: string[];
  timeSlots: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  disclose: { personalities: boolean; intro: boolean; bio: boolean };
  confirmed: boolean;
  /** 같은 초안을 두 번 제출해도 한 건만 생기도록 하는 키 */
  idempotencyKey: string;
  updatedAt: string;
}

export function emptyDraft(idempotencyKey: string): ApplicationDraft {
  return {
    nickname: "", birthYear: null, gender: "", bio: "",
    hobbies: [], preferredPlaces: [], moods: [], foods: [], avoidPlaces: [], smoking: "",
    personalities: [], contactStyles: [], intro: "",
    ageMin: 25, ageMax: 35, partnerPersonalities: [], tempo: "",
    stations: [], dates: [], timeSlots: [], budgetMin: null, budgetMax: null,
    disclose: { personalities: true, intro: true, bio: false },
    confirmed: false, idempotencyKey, updatedAt: new Date().toISOString(),
  };
}

/** 예전 형식으로 저장된 초안에 빠진 칸을 채운다 */
export function normalizeDraft(raw: Partial<ApplicationDraft> & { idempotencyKey: string }): ApplicationDraft {
  const base = emptyDraft(raw.idempotencyKey);
  return { ...base, ...raw, disclose: { ...base.disclose, ...(raw.disclose ?? {}) } };
}

/** 고를 수 있는 출생 연도: 올해 기준 만 AGE_MIN~AGE_MAX세 (자기 신고값, 본인확인 아님) */
export function birthYearOptions(now: Date = new Date()): number[] {
  const year = Number(seoulDateString(now).slice(0, 4));
  const out: number[] = [];
  for (let y = year - AGE_MIN; y >= year - AGE_MAX; y--) out.push(y);
  return out;
}

const tags = <T extends readonly string[]>(opts: T, min: number, minMsg: string, max?: number, maxMsg?: string) => {
  let s = z.array(z.enum(opts as unknown as [string, ...string[]], { message: "선택지에 없는 값이 있어요." }));
  s = s.min(min, { message: minMsg });
  if (max !== undefined) s = s.max(max, { message: maxMsg ?? `최대 ${max}개까지 고를 수 있어요.` });
  return s.refine((a) => new Set(a).size === a.length, { message: "중복 선택이 있어요." });
};

const oneOf = <T extends readonly string[]>(opts: T, msg: string) =>
  z.string().refine((v) => (opts as readonly string[]).includes(v), { message: msg });

export function step1Schema(now: Date = new Date()) {
  const years = new Set(birthYearOptions(now));
  return z.object({
    nickname: z.string().transform((s) => s.trim()).pipe(
      z.string()
        .min(1, { message: "닉네임을 입력해주세요." })
        .max(NICKNAME_MAX, { message: `닉네임은 ${NICKNAME_MAX}자 이내로 써주세요.` }),
    ),
    birthYear: z.number({ message: "태어난 연도를 선택해주세요." }).nullable()
      .refine((v) => v !== null, { message: "태어난 연도를 선택해주세요." })
      .refine((v) => v === null || years.has(v), { message: `만 ${AGE_MIN}~${AGE_MAX}세만 신청할 수 있어요.` }),
    gender: oneOf(GENDERS, "성별을 선택해주세요."),
    bio: z.string().max(BIO_MAX, { message: `자기소개는 ${BIO_MAX}자 이내로 써주세요.` }),
  });
}

export const step2Schema = z.object({
  hobbies: tags(HOBBIES, 1, "취미를 1개 이상 골라주세요."),
  preferredPlaces: tags(PREFERRED_PLACES, 1, "선호 장소를 1개 이상 골라주세요."),
  moods: tags(MOODS, 1, "선호하는 분위기를 1개 이상 골라주세요."),
  foods: tags(FOODS, 1, "좋아하는 음식을 1개 이상 골라주세요."),
  avoidPlaces: tags(AVOID_PLACES, 0, ""),
  smoking: oneOf(SMOKING, "흡연 여부를 선택해주세요."),
});

export const step3Schema = z.object({
  personalities: tags(PERSONALITIES, 1, "나의 성격을 1개 이상 골라주세요."),
  contactStyles: tags(CONTACT_STYLES, 1, "연락 스타일을 1개 이상 골라주세요."),
  intro: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z.string()
        .min(1, { message: "한 줄 소개를 입력해주세요. 공백만으로는 저장되지 않아요." })
        .max(INTRO_MAX, { message: `한 줄 소개는 ${INTRO_MAX}자 이내로 써주세요.` }),
    ),
});

export const step4Schema = z
  .object({
    ageMin: z.number().int().min(AGE_MIN, { message: `${AGE_MIN}살 이상만 고를 수 있어요.` }).max(AGE_MAX),
    ageMax: z.number().int().min(AGE_MIN).max(AGE_MAX, { message: `${AGE_MAX}살 이하로 골라주세요.` }),
    partnerPersonalities: tags(PERSONALITIES, 0, ""),
    tempo: z.union([z.literal(""), z.enum(TEMPOS as unknown as [string, ...string[]])]),
  })
  .refine((v) => v.ageMin <= v.ageMax, { path: ["ageMin"], message: "최소 나이가 최대 나이보다 클 수 없어요." });

const SLOT_IDS = TIME_SLOTS.map((t) => t.id) as unknown as [string, ...string[]];

export function confirmSchema(now: Date = new Date()) {
  const allowed = new Set(upcomingDates(now));
  const won = (label: string) =>
    z.number({ message: `${label}을 입력해주세요.` })
      .int({ message: "원 단위 숫자로 입력해주세요." })
      .min(0, { message: "0원 이상으로 입력해주세요." })
      .max(BUDGET_MAX, { message: `${BUDGET_MAX.toLocaleString("ko-KR")}원 이하로 입력해주세요.` });
  return z
    .object({
      stations: tags(STATIONS, 1, "가능한 역을 1곳 이상 골라주세요.", MAX_STATIONS, `역은 최대 ${MAX_STATIONS}곳까지 고를 수 있어요.`),
      dates: z
        .array(z.string())
        .min(1, { message: "앞으로 2주 안에서 가능한 날짜를 1개 이상 골라주세요." })
        .max(MAX_DATES, { message: `날짜는 최대 ${MAX_DATES}개까지 고를 수 있어요.` })
        .refine((a) => a.every((d) => allowed.has(d)), { message: "앞으로 2주 안의 날짜만 고를 수 있어요." })
        .refine((a) => new Set(a).size === a.length, { message: "중복 선택이 있어요." }),
      timeSlots: z
        .array(z.enum(SLOT_IDS, { message: "선택지에 없는 시간대예요." }))
        .min(1, { message: "가능한 시간대를 1개 이상 골라주세요." })
        .max(MAX_TIME_SLOTS, { message: `시간대는 최대 ${MAX_TIME_SLOTS}개까지 고를 수 있어요.` }),
      budgetMin: won("최소 예산").nullable().refine((v) => v !== null, { message: "1인 최소 예산을 입력해주세요." }),
      budgetMax: won("최대 예산").nullable().refine((v) => v !== null, { message: "1인 최대 예산을 입력해주세요." }),
      disclose: z.object({ personalities: z.boolean(), intro: z.literal(true), bio: z.boolean() }),
      confirmed: z.literal(true, { message: "공개할 소개 내용을 확인하고 체크해주세요." }),
    })
    .refine((v) => v.budgetMin === null || v.budgetMax === null || v.budgetMin <= v.budgetMax, {
      path: ["budgetMax"],
      message: "최대 예산은 최소 예산보다 크거나 같아야 해요.",
    })
    // 토요일만 골랐는데 '평일 저녁'만 고른 것처럼 맞는 조합이 없는 선택을 막는다
    .refine((v) => v.timeSlots.length === 0 || v.dates.every((d) => v.timeSlots.some((t) => slotFitsDate(t, d))), {
      path: ["dates"],
      message: "고른 날짜 중 시간대와 맞지 않는 날이 있어요. 평일은 '평일 저녁', 토·일은 주말 시간대를 함께 골라주세요.",
    })
    .refine((v) => v.dates.length === 0 || v.timeSlots.every((t) => v.dates.some((d) => slotFitsDate(t, d))), {
      path: ["timeSlots"],
      message: "고른 시간대에 맞는 날짜가 없어요. 주말 시간대는 토·일, '평일 저녁'은 월~금 날짜와 함께 골라주세요.",
    });
}

/** 1~4 = 신청 단계, 5 = 제출 전 확인 */
export type StepKey = 1 | 2 | 3 | 4 | 5;
export const STEPS: readonly StepKey[] = [1, 2, 3, 4, 5];
export type FieldErrors = Partial<Record<string, string>>;

function toErrors(result: { success: boolean; error?: z.ZodError }): FieldErrors {
  if (result.success || !result.error) return {};
  const out: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function validateStep(step: StepKey, draft: ApplicationDraft, now: Date = new Date()): FieldErrors {
  switch (step) {
    case 1: return toErrors(step1Schema(now).safeParse(draft));
    case 2: return toErrors(step2Schema.safeParse(draft));
    case 3: return toErrors(step3Schema.safeParse(draft));
    case 4: return toErrors(step4Schema.safeParse(draft));
    case 5: return toErrors(confirmSchema(now).safeParse(draft));
  }
}

/** 처음으로 통과하지 못한 단계. 모두 통과하면 null */
export function firstInvalidStep(draft: ApplicationDraft, now: Date = new Date()): StepKey | null {
  for (const s of STEPS) {
    if (Object.keys(validateStep(s, draft, now)).length > 0) return s;
  }
  return null;
}

/** 제출 시 서버(현재는 데모 저장소)가 다시 검증하는 전체 스키마 */
export function parseSubmission(draft: ApplicationDraft, now: Date = new Date()) {
  const errors: FieldErrors = {};
  for (const s of STEPS) Object.assign(errors, validateStep(s, draft, now));
  if (Object.keys(errors).length > 0) return { ok: false as const, errors };
  return {
    ok: true as const,
    value: {
      ...step1Schema(now).parse(draft),
      ...step2Schema.parse(draft),
      ...step3Schema.parse(draft),
      ...step4Schema.parse(draft),
      ...confirmSchema(now).parse(draft),
    },
  };
}

export type SubmittedApplication = Extract<ReturnType<typeof parseSubmission>, { ok: true }>["value"];

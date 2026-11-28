"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApplyShell, STEP_PATH, StepActions, useStepValidation } from "@/components/apply-shell";
import { Field, TagChip, TagGroup, TextInput } from "@/components/form";
import { Card, cx } from "@/components/ui";
import { formatDateChip, upcomingDates } from "@/lib/apply/dates";
import { MAX_DATES, MAX_STATIONS, MAX_TIME_SLOTS, STATIONS, TIME_SLOTS } from "@/lib/apply/options";
import { firstInvalidStep, type ApplicationDraft, type FieldErrors } from "@/lib/apply/schema";
import { useApp } from "@/lib/store";

const toWon = (s: string): number | null => {
  const digits = s.replace(/[^0-9]/g, "");
  return digits === "" ? null : Number(digits);
};

function Check({ checked, onChange, disabled, children, id }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: React.ReactNode; id: string }) {
  return (
    <label htmlFor={id} className={cx("flex min-h-11 items-start gap-3 py-1 text-[15px]", disabled && "opacity-50")}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Confirm({ draft, onBusy }: { draft: ApplicationDraft; onBusy: (b: boolean) => void }) {
  const { updateDraft, submit } = useApp();
  const router = useRouter();
  const { errors: stepErrors, valid, attempt } = useStepValidation(5, draft);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const dates = upcomingDates();
  const errors = { ...serverErrors, ...stepErrors };

  // 며칠 뒤 돌아오면 지난 날짜가 초안에 남아 있을 수 있어 정리한다
  const stale = draft.dates.filter((d) => !dates.includes(d));
  useEffect(() => {
    if (stale.length > 0) updateDraft({ dates: draft.dates.filter((d) => dates.includes(d)) });
  }, [stale.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async () => {
    if (busyRef.current) return; // 연속 클릭 차단 (저장소도 같은 키로 한 건만 만든다)
    if (!attempt()) return;
    busyRef.current = true;
    setBusy(true);
    onBusy(true);
    const res = await submit();
    if (res.ok) {
      router.replace(`/apply/done?no=${encodeURIComponent(res.application.number)}`);
      return;
    }
    busyRef.current = false;
    setBusy(false);
    onBusy(false);
    setServerErrors(res.errors);
    const inv = firstInvalidStep(draft);
    if (inv !== null && inv < 5) router.push(STEP_PATH[inv]);
  };

  const toggleIn = (key: "dates" | "timeSlots", v: string, max: number) => {
    const cur = draft[key];
    if (cur.includes(v)) updateDraft({ [key]: cur.filter((x) => x !== v) });
    else if (cur.length < max) updateDraft({ [key]: [...cur, v] });
  };

  return (
    <div>
      <p className="-mt-4 mb-8 text-center text-[14px] text-muted">운영자가 소개할 때 사용할 정보예요.</p>

      <Field id="stations" as="fieldset" label="가능한 역" hint={`최대 ${MAX_STATIONS}곳`} error={errors.stations}>
        <TagGroup label="가능한 역" options={STATIONS} value={draft.stations} max={MAX_STATIONS} onChange={(v) => updateDraft({ stations: v })} />
      </Field>

      <Field id="dates" as="fieldset" label="앞으로 2주 중 가능한 날짜" hint={`최대 ${MAX_DATES}일`} error={errors.dates}>
        <div role="group" aria-label="가능한 날짜" className="grid grid-cols-4 gap-2">
          {dates.map((d) => {
            const sel = draft.dates.includes(d);
            return (
              <button key={d} type="button" aria-pressed={sel} disabled={!sel && draft.dates.length >= MAX_DATES}
                onClick={() => toggleIn("dates", d, MAX_DATES)}
                className={cx("min-h-11 rounded-xl border text-[13px] disabled:opacity-40",
                  sel ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-line bg-white text-ink/70")}>
                {formatDateChip(d)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field id="timeSlots" as="fieldset" label="가능한 시간대" hint={`최대 ${MAX_TIME_SLOTS}개`} error={errors.timeSlots}>
        <div role="group" aria-label="가능한 시간대" className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((t) => (
            <TagChip key={t.id} selected={draft.timeSlots.includes(t.id)}
              disabled={!draft.timeSlots.includes(t.id) && draft.timeSlots.length >= MAX_TIME_SLOTS}
              onClick={() => toggleIn("timeSlots", t.id, MAX_TIME_SLOTS)}>{t.label}</TagChip>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">평일 저녁은 월~금, 주말 시간대는 토·일 날짜에만 적용돼요.</p>
      </Field>

      <Field id="budgetMin" label="1인 예산 (식음료)" hint="필수" error={errors.budgetMin ?? errors.budgetMax}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <TextInput id="budget-min" label="1인 최소 예산(원)" inputMode="numeric" placeholder="최소 (원)"
              value={draft.budgetMin === null ? "" : draft.budgetMin.toLocaleString("ko-KR")} invalid={!!errors.budgetMin}
              onChange={(v) => updateDraft({ budgetMin: toWon(v) })} />
          </div>
          <span aria-hidden>~</span>
          <div className="min-w-0 flex-1">
            <TextInput id="budget-max" label="1인 최대 예산(원)" inputMode="numeric" placeholder="최대 (원)"
              value={draft.budgetMax === null ? "" : draft.budgetMax.toLocaleString("ko-KR")} invalid={!!errors.budgetMax}
              onChange={(v) => updateDraft({ budgetMax: toWon(v) })} />
          </div>
        </div>
        <p className="mt-1 text-[12px] text-muted">이용료(1인 9,900원)와 별도로, 매장에서 쓸 식음료 예산이에요.</p>
      </Field>

      <Field id="confirmed" as="fieldset" label="상대에게 공개할 소개" hint="확인 필수" error={errors.confirmed}>
        <Card className="space-y-1">
          <Check id="disclose-nickname" checked disabled onChange={() => undefined}>
            닉네임 <span className="text-muted">(항상 공개)</span> <strong data-testid="preview-nickname">{draft.nickname.trim() || "—"}</strong>
          </Check>
          <Check id="disclose-intro" checked disabled onChange={() => undefined}>
            한 줄 소개 <span className="text-muted">(항상 공개)</span>
            <span className="mt-1 block rounded-lg bg-field px-3 py-2 text-[14px]" data-testid="preview-intro">{draft.intro.trim() || "—"}</span>
          </Check>
          <Check id="disclose-personalities" checked={draft.disclose.personalities}
            onChange={(v) => updateDraft({ disclose: { ...draft.disclose, personalities: v } })}>
            나의 성격 <span className="text-[14px] text-muted">{draft.personalities.join(", ") || "—"}</span>
          </Check>
          <Check id="disclose-bio" checked={draft.disclose.bio && draft.bio.trim() !== ""} disabled={draft.bio.trim() === ""}
            onChange={(v) => updateDraft({ disclose: { ...draft.disclose, bio: v } })}>
            자기소개 {draft.bio.trim() === "" && <span className="text-muted">(작성하지 않음)</span>}
          </Check>
          <p className="pt-2 text-[13px] leading-relaxed text-muted">
            태어난 연도·성별·흡연 여부·취향·상대 선호·가능한 일정·예산은 상대에게 그대로 보이지 않고, 운영자가 소개할 때만 참고해요.
            소개는 두 분이 모두 공개에 동의한 내용만 전달돼요.
          </p>
        </Card>
        <div className="mt-3">
          <Check id="confirm-check" checked={draft.confirmed} onChange={(v) => updateDraft({ confirmed: v })}>
            위 내용을 확인했고, 운영자 검토를 위해 신청 내용을 제출해요.
          </Check>
        </div>
      </Field>

      {errors._form && <p role="alert" className="mb-3 text-[13px] text-red-600">{errors._form}</p>}
      <p className="text-center text-[13px] text-muted">
        수정이 필요하면 <Link href="/apply/1" className="underline">1단계</Link>부터 다시 볼 수 있어요. 입력값은 그대로 남아 있어요.
      </p>
      <StepActions valid={valid} busy={busy} nextLabel="신청 제출하기" onPrev={() => router.push("/apply/4")} onNext={onSubmit} />
    </div>
  );
}

export default function ConfirmPage() {
  const [hold, setHold] = useState(false);
  return (
    <ApplyShell step={5} title="제출 전에 확인해주세요" holdGuard={hold}>
      {(d) => <Confirm draft={d} onBusy={setHold} />}
    </ApplyShell>
  );
}

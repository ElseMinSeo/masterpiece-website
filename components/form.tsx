"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./ui";

/** 필드 묶음: 라벨 + 우측 보조문구(복수선택/필수/선택) + 오류 */
export function Field({
  label, hint, hintTone = "brand", error, children, id, as = "div",
}: {
  label: string; hint?: string; hintTone?: "brand" | "muted"; error?: string; children: ReactNode; id?: string; as?: "div" | "fieldset";
}) {
  const errId = `${id ?? label}-error`;
  const Tag = as;
  const LabelTag = as === "fieldset" ? "legend" : "div";
  return (
    <Tag className="mb-8 min-w-0" data-field={id} aria-describedby={error ? errId : undefined}>
      <LabelTag className="mb-3 flex w-full items-center justify-between gap-3">
        <span className="text-[15px] font-semibold">{label}</span>
        {hint && <span className={cx("shrink-0 text-[14px]", hintTone === "brand" ? "text-brand-ink" : "text-muted")}>{hint}</span>}
      </LabelTag>
      {children}
      {error && (
        <p id={errId} role="alert" className="mt-2 text-[13px] text-red-600">{error}</p>
      )}
    </Tag>
  );
}

/** 선택 태그 (새 시안 Matching2: 선택 시 핑크 채움, 기본은 회색 채움) */
export function TagChip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "min-h-11 rounded-full px-5 text-[15px] transition-colors",
        selected ? "bg-brand font-semibold text-white" : "bg-field text-ink/80",
        disabled && !selected && "opacity-40",
      )}
    >
      {children}
    </button>
  );
}

/** 둘 중 하나 고르는 큰 버튼 (새 시안: 남성/여성, 흡연/비흡연) */
export function SegmentGroup<T extends string>({ options, value, onChange, label }: {
  options: readonly T[]; value: string; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-3">
      {options.map((o) => (
        <button
          key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cx(
            "min-h-13 flex-1 rounded-full text-[16px] transition-colors",
            value === o ? "bg-brand font-semibold text-white" : "bg-field text-ink",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function TagGroup<T extends string>({ options, value, onChange, max, label }: {
  options: readonly T[]; value: string[]; onChange: (v: string[]) => void; max?: number; label: string;
}) {
  const full = max !== undefined && value.length >= max;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const sel = value.includes(o);
        return (
          <TagChip key={o} selected={sel} disabled={!sel && full}
            onClick={() => onChange(sel ? value.filter((v) => v !== o) : [...value, o])}>
            {o}
          </TagChip>
        );
      })}
    </div>
  );
}

/** 라디오형 카드 (시안 10 연락 스타일 · 시안 11 만남 템포) */
export function OptionCard({ selected, onClick, children, role = "checkbox" }: { selected: boolean; onClick: () => void; children: ReactNode; role?: "checkbox" | "radio" }) {
  return (
    <button
      type="button" role={role} aria-checked={selected} onClick={onClick}
      className={cx(
        "flex min-h-13 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border px-3 py-3 text-left text-[15px] max-[359px]:justify-center",
        selected ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-white text-ink/60",
      )}
    >
      <span className="min-w-0 break-keep [overflow-wrap:normal]">{children}</span>
      <span aria-hidden className={cx("grid size-5 shrink-0 place-items-center rounded-full border-2 max-[359px]:hidden", selected ? "border-brand" : "border-line")}>
        {selected && <span className="size-2 rounded-full bg-brand" />}
      </span>
    </button>
  );
}

export function TextInput({ value, onChange, placeholder, maxLength, invalid, id, label, inputMode, type = "text", autoComplete, spellCheck }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; invalid?: boolean; id: string; label: string;
  inputMode?: "numeric" | "text"; type?: string;
  /** 휴대폰 자동입력 힌트 (예: "email", "one-time-code") */
  autoComplete?: string; spellCheck?: boolean;
}) {
  return (
    <input
      id={id} aria-label={label} aria-invalid={invalid || undefined} type={type} inputMode={inputMode}
      autoComplete={autoComplete} spellCheck={spellCheck}
      value={value} maxLength={maxLength} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "h-13 w-full min-w-0 rounded-xl bg-field px-4 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/40",
        invalid && "ring-2 ring-red-400",
      )}
    />
  );
}

export function TextArea({ value, onChange, placeholder, maxLength, invalid, id, label }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; invalid?: boolean; id: string; label: string;
}) {
  const countId = useId();
  return (
    <div>
      <textarea
        id={id} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={countId}
        value={value} placeholder={placeholder} rows={5}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          "w-full resize-none rounded-xl bg-field px-4 py-3.5 text-[16px] leading-relaxed outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/40",
          invalid && "ring-2 ring-red-400",
        )}
      />
      {maxLength && (
        <p id={countId} className={cx("mt-1 text-right text-[12px]", value.length > maxLength ? "text-red-600" : "text-muted")}>
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

/** 단계 표시 (새 시안: 4단계) */
export function StepIndicator({ current, total = 4 }: { current: number; total?: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <ol aria-label={`${total}단계 중 ${Math.min(current, total)}단계`} className="flex items-center justify-center">
      {steps.map((n, i) => (
        <li key={n} className="flex items-center">
          {i > 0 && <span aria-hidden className={cx("h-px w-5", n <= current ? "bg-brand" : "bg-line")} />}
          <span
            aria-current={n === current ? "step" : undefined}
            className={cx(
              "grid size-9 place-items-center rounded-full border text-[16px]",
              n <= current ? "border-brand bg-brand font-semibold text-white" : "border-line bg-white text-muted",
            )}
          >
            {n}
          </span>
        </li>
      ))}
    </ol>
  );
}

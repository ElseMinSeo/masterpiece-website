"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Loading, TopBar } from "@/components/ui";
import { POLICY_VERSION } from "@/lib/consent";
import { safeNext } from "@/lib/safe-next";
import { createBrowserSupabase } from "@/lib/supabase/browser";


function ConsentForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!terms || !privacy) return setError("필수 항목에 모두 동의해주세요.");
    setBusy(true);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    const purposes = ["terms", "privacy", ...(marketing ? ["marketing"] : [])];
    const { error: e } = await supabase.from("consents")
      .insert(purposes.map((purpose) => ({ user_id: data.user!.id, purpose, policy_version: POLICY_VERSION })));
    setBusy(false);
    if (e) return setError("저장하지 못했어요. 잠시 뒤 다시 시도해주세요.");
    window.location.assign(next);
  };

  const Row = ({ id, checked, onChange, label, required }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; required?: boolean }) => (
    <label htmlFor={id} className="flex min-h-12 items-center gap-3 text-[15px]">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => { onChange(e.target.checked); setError(""); }}
        className="size-5 shrink-0 accent-[var(--color-brand)]" />
      <span>{label} <span className={required ? "text-brand-ink" : "text-muted"}>({required ? "필수" : "선택"})</span></span>
    </label>
  );

  return (
    <div className="px-5 pt-6">
      <h2 className="text-[22px] font-bold">시작하기 전에 동의가 필요해요</h2>
      <Card className="mt-6">
        <Row id="c-terms" checked={terms} onChange={setTerms} label="서비스 이용약관 동의" required />
        <Row id="c-privacy" checked={privacy} onChange={setPrivacy} label="개인정보 수집·이용 동의" required />
        <Row id="c-marketing" checked={marketing} onChange={setMarketing} label="이벤트·새 소식 받기" />
        <p className="mt-2 text-[12px] text-muted">약관 본문은 확정 전이에요(버전 {POLICY_VERSION}). 확정되면 다시 동의를 받아요.</p>
      </Card>
      {error && <p role="alert" className="mt-3 text-[13px] text-red-600">{error}</p>}
      <Button block className="mt-6" disabled={busy} onClick={() => void submit()}>동의하고 시작하기</Button>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <main>
      <TopBar title="약관 동의" back={false} />
      <Suspense fallback={<Loading />}><ConsentForm /></Suspense>
    </main>
  );
}

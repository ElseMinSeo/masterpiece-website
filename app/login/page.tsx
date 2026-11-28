"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Field, TextInput } from "@/components/form";
import { Button, Card, LinkButton, Loading, TopBar } from "@/components/ui";
import { dataSource } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function LoginForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError("이메일 형식이 올바르지 않아요.");
    setBusy(true);
    setError("");
    const { error: e } = await createBrowserSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) return setError("코드를 보내지 못했어요. 잠시 뒤 다시 시도해주세요.");
    setSent(true);
    setWait(60);
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setError("6자리 숫자를 입력해주세요.");
    setBusy(true);
    setError("");
    const { error: e } = await createBrowserSupabase().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    setBusy(false);
    if (e) return setError("코드가 맞지 않거나 만료됐어요. 다시 받아주세요.");
    window.location.assign(next);
  };

  return (
    <div className="px-5 pt-6">
      <h2 className="text-[22px] font-bold">첫, 길 시작하기</h2>
      <p className="mt-2 text-[14px] text-ink/70">이메일로 받은 6자리 코드로 로그인해요. 처음이면 자동으로 가입돼요.</p>
      <form className="mt-8" noValidate onSubmit={(e) => { e.preventDefault(); void (sent ? verify() : send()); }}>
        <Field id="email" label="이메일" error={!sent ? error : undefined}>
          <TextInput id="email-input" label="이메일" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(v) => { setEmail(v); setSent(false); }}
            placeholder="you@example.com" invalid={!sent && !!error} />
        </Field>
        {sent && (
          <Field id="code" label="6자리 코드" error={error}>
            <TextInput id="code-input" label="6자리 코드" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} maxLength={6} value={code}
              onChange={(v) => setCode(v.replace(/\D/g, ""))} placeholder="123456" invalid={!!error} />
            <p className="mt-2 text-[13px] text-muted">{email}로 보냈어요. 메일이 없으면 스팸함을 확인해주세요.</p>
          </Field>
        )}
        <Button type="submit" block disabled={busy}>{sent ? "로그인" : "코드 받기"}</Button>
        {sent && (
          <Button type="button" variant="ghost" block className="mt-2 text-[14px]" disabled={wait > 0 || busy} onClick={() => void send()}>
            {wait > 0 ? `${wait}초 뒤 다시 받기` : "코드 다시 받기"}
          </Button>
        )}
      </form>
    </div>
  );
}

export default function LoginPage() {
  if (dataSource() !== "supabase") {
    return (
      <main>
        <TopBar title="로그인" back="/home" />
        <div className="px-5 pt-6">
          <Card>
            <p className="font-semibold">데모 모드에서는 로그인이 필요 없어요</p>
            <p className="mt-1 text-[14px] text-muted">입력한 내용은 이 기기의 브라우저에만 저장돼요.</p>
            <LinkButton href="/home" className="mt-4">홈으로</LinkButton>
          </Card>
        </div>
      </main>
    );
  }
  return (
    <main>
      <TopBar title="로그인" back="/home" />
      <Suspense fallback={<Loading />}><LoginForm /></Suspense>
    </main>
  );
}

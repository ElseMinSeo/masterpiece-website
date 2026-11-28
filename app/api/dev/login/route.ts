import { NextResponse } from "next/server";
import { POLICY_VERSION } from "@/lib/consent";
import { devToolsEnabled } from "@/lib/dev-login";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

// 개발 전용 테스트 로그인. 플래그와 로컬 Supabase 주소가 모두 있을 때만 동작하고, 아니면 없는 주소처럼 404.
export async function POST(request: Request) {
  if (!devToolsEnabled()) return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "invalid email" }, { status: 400 });

  const { data, error } = await createAdminSupabase().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.email_otp) {
    // 처음 보는 이메일이면 만든 뒤 다시 시도
    const created = await createAdminSupabase().auth.admin.createUser({ email, email_confirm: true });
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
    return POST(new Request(request.url, { method: "POST", body: JSON.stringify({ email }) }));
  }
  const supabase = await createServerSupabase();
  const verified = await supabase.auth.verifyOtp({ email, token: data.properties.email_otp, type: "email" });
  if (verified.error || !verified.data.user) return NextResponse.json({ error: "verify failed" }, { status: 500 });
  await supabase.from("consents").insert(
    ["terms", "privacy"].map((purpose) => ({ user_id: verified.data.user!.id, purpose, policy_version: POLICY_VERSION })),
  );
  return NextResponse.json({ ok: true, userId: verified.data.user.id });
}

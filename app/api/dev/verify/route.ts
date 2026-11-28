import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { getVerificationProvider } from "@/lib/verification";

const provider = () =>
  getVerificationProvider({ DEV_TEST_LOGIN: process.env.DEV_TEST_LOGIN, url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "" });

/** 개발 도구 사용 가능 여부 (화면에서 버튼을 보일지 정할 때) */
export async function GET() {
  return provider() ? NextResponse.json({ enabled: true }) : new NextResponse(null, { status: 404 });
}

/** 개발 전용: 로그인한 본인을 흉내 공급자로 확인 처리한다 */
export async function POST(request: Request) {
  const p = provider();
  if (!p) return new NextResponse(null, { status: 404 });
  const { data } = await (await createServerSupabase()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: "login required" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { outcome?: string };
  const outcome = body.outcome === "failed" ? "failed" : "verified";
  const { ref } = await p.start(data.user.id);
  const { status } = await p.complete(ref, outcome);
  const { error } = await createAdminSupabase().from("private_profiles").update(
    status === "verified"
      ? { verification_status: "verified", verified_at: new Date().toISOString(), provider_ref: ref }
      : { verification_status: "unverified", verified_at: null, provider_ref: ref },
  ).eq("user_id", data.user.id);
  if (error) return NextResponse.json({ error: "update failed" }, { status: 500 });
  return NextResponse.json({ status });
}

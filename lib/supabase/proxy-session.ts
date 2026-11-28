import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicEnv } from "@/lib/env";

/** 로그인해야 들어갈 수 있는 경로 */
export const PROTECTED_PREFIXES = ["/apply", "/appointments", "/saved", "/profile", "/onboarding"];
export const REQUIRED_CONSENTS = ["terms", "privacy"] as const;

const isProtected = (path: string) => PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

/** 세션 쿠키를 갱신하고, 로그인·필수 동의가 없으면 알맞은 화면으로 보낸다 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, anonKey } = supabasePublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const path = request.nextUrl.pathname;
  const next = encodeURIComponent(path + request.nextUrl.search);

  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!userId) {
    return isProtected(path) ? redirect(`/login?next=${next}`) : response;
  }

  if (isProtected(path) && !path.startsWith("/onboarding")) {
    const { data: rows } = await supabase
      .from("consents").select("purpose").is("revoked_at", null).in("purpose", [...REQUIRED_CONSENTS]);
    const have = new Set((rows ?? []).map((r) => r.purpose));
    if (!REQUIRED_CONSENTS.every((p) => have.has(p))) return redirect(`/onboarding/consent?next=${next}`);
  }
  return response;
}

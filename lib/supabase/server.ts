import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "@/lib/env";

/** 요청 쿠키의 로그인 세션으로 동작하는 서버용 클라이언트. RLS가 그대로 적용된다. */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const { url, anonKey } = supabasePublicEnv();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts가 맡는다.
        }
      },
    },
  });
}

/** 모든 규칙을 무시하는 관리자 클라이언트. 서버 전용, 개발 도구와 운영 작업에만 쓴다. */
export function createAdminSupabase(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았어요.");
  return createClient(supabasePublicEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

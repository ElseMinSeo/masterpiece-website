"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/** 브라우저용 Supabase 클라이언트 (세션은 쿠키에 저장되어 서버와 공유) */
export function createBrowserSupabase(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = supabasePublicEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}

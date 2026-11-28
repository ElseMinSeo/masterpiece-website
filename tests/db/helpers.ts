import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { POLICY_VERSION, REQUIRED_CONSENTS } from "@/lib/consent";

const URL = process.env.SUPABASE_TEST_URL!;
const ANON = process.env.SUPABASE_TEST_ANON_KEY!;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** 모든 규칙을 무시하는 관리자 클라이언트 (테스트 준비용) */
export function admin(): SupabaseClient {
  return createClient(URL, SERVICE, opts);
}

/** 로그인하지 않은 방문자 */
export function anon(): SupabaseClient {
  return createClient(URL, ANON, opts);
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** 테스트마다 새 사용자를 만들고 그 사용자로 로그인한 클라이언트를 돌려준다.
 * 기본으로 현재 버전 필수 약관(terms, privacy)에 동의한 상태로 만든다. */
export async function makeUser(tag: string, options: { consent?: boolean } = {}): Promise<TestUser> {
  const email = `${tag}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = createClient(URL, ANON, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  if (options.consent !== false) {
    const rows = REQUIRED_CONSENTS.map((purpose) => ({ user_id: data.user.id, purpose, policy_version: POLICY_VERSION }));
    const { error: consentError } = await client.from("consents").insert(rows);
    if (consentError) throw consentError;
  }
  return { id: data.user.id, email, client };
}

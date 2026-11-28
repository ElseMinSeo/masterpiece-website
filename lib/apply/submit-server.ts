// 신청 제출의 서버 쪽 처리. 로그인 세션의 Supabase 클라이언트로 동작하므로 RLS와 DB 제약이 함께 적용된다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toApplication, type ApplicationRow } from "@/lib/repo/mapping";
import type { Application } from "@/lib/repo/types";
import { normalizeDraft, parseSubmission, type ApplicationDraft, type FieldErrors } from "./schema";

export type SubmitResponse =
  | { status: 200; body: { application: Application; duplicate: boolean } }
  | { status: 401 | 422 | 500; body: { errors: FieldErrors } };

export async function submitForUser(supabase: SupabaseClient, body: unknown, now: Date = new Date()): Promise<SubmitResponse> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 401, body: { errors: { _form: "로그인이 필요해요." } } };

  const raw = body as Partial<ApplicationDraft> | null;
  if (!raw || typeof raw !== "object" || typeof raw.idempotencyKey !== "string" || raw.idempotencyKey.length === 0) {
    return { status: 422, body: { errors: { _form: "신청서 형식이 올바르지 않아요." } } };
  }
  const draft = normalizeDraft(raw as Partial<ApplicationDraft> & { idempotencyKey: string });
  const parsed = parseSubmission(draft, now);
  if (!parsed.ok) return { status: 422, body: { errors: parsed.errors } };

  const { data: existing } = await supabase
    .from("applications").select("id").eq("idempotency_key", draft.idempotencyKey).maybeSingle();
  const { data, error } = await supabase.rpc("submit_application", {
    p_idempotency_key: draft.idempotencyKey,
    p_payload: parsed.value,
  });
  if (error || !data) return { status: 500, body: { errors: { _form: "신청을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." } } };
  const row = data as ApplicationRow;
  return {
    status: 200,
    body: { application: toApplication(row), duplicate: Boolean(existing) || row.idempotency_key !== draft.idempotencyKey },
  };
}

// 신청 제출의 서버 쪽 처리.
// 1) 로그인 세션(userDb)으로 사용자를 확인하고 2) Zod로 검증한 뒤 3) 서버 전용 키(serverDb)로 제출 함수를 부른다.
// 제출 함수는 서버 전용이라, 브라우저에서 직접 불러 검증을 건너뛸 수 없다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toApplication, type ApplicationRow } from "@/lib/repo/mapping";
import type { Application } from "@/lib/repo/types";
import { normalizeDraft, parseSubmission, type ApplicationDraft, type FieldErrors } from "./schema";

export type SubmitResponse =
  | { status: 200; body: { application: Application; duplicate: boolean } }
  | { status: 401 | 422 | 500; body: { errors: FieldErrors } };

export async function submitForUser(
  userDb: SupabaseClient, serverDb: SupabaseClient, body: unknown, now: Date = new Date(),
): Promise<SubmitResponse> {
  const { data: auth } = await userDb.auth.getUser();
  if (!auth.user) return { status: 401, body: { errors: { _form: "로그인이 필요해요." } } };

  const raw = body as Partial<ApplicationDraft> | null;
  if (!raw || typeof raw !== "object" || typeof raw.idempotencyKey !== "string" || raw.idempotencyKey.length === 0) {
    return { status: 422, body: { errors: { _form: "신청서 형식이 올바르지 않아요." } } };
  }
  const draft = normalizeDraft(raw as Partial<ApplicationDraft> & { idempotencyKey: string });
  const parsed = parseSubmission(draft, now);
  if (!parsed.ok) return { status: 422, body: { errors: parsed.errors } };

  const userId = auth.user.id;
  const { data: existing } = await userDb
    .from("applications").select("id").eq("user_id", userId).eq("idempotency_key", draft.idempotencyKey).maybeSingle();
  const { data, error } = await serverDb.rpc("submit_application", {
    p_user_id: userId,
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

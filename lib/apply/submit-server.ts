// 신청 제출의 서버 쪽 처리.
// 1) 로그인 세션(userDb)으로 사용자를 확인하고 2) 필수 약관 동의·계정 상태를 확인하고
// 3) Zod로 검증한 뒤 4) 서버 전용 키(serverDb)로 제출 함수를 부른다.
// 제출 함수는 서버 전용이라, 브라우저에서 직접 불러 검증을 건너뛸 수 없다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRequiredConsents, REQUIRED_CONSENTS } from "@/lib/consent";
import { toApplication, type ApplicationRow } from "@/lib/repo/mapping";
import type { Application } from "@/lib/repo/types";
import { normalizeDraft, parseSubmission, type ApplicationDraft, type FieldErrors } from "./schema";

export type SubmitResponse =
  | { status: 200; body: { application: Application; duplicate: boolean } }
  | { status: 409; body: { errors: FieldErrors; activeNumber?: string } }
  | { status: 401 | 403 | 422 | 500; body: { errors: FieldErrors } };

export async function submitForUser(
  userDb: SupabaseClient, serverDb: SupabaseClient, body: unknown, now: Date = new Date(),
): Promise<SubmitResponse> {
  const { data: auth } = await userDb.auth.getUser();
  if (!auth.user) return { status: 401, body: { errors: { _form: "로그인이 필요해요." } } };
  const userId = auth.user.id;

  // 화면 이동 검사(proxy)는 /api 경로를 거치지 않으므로 여기서 다시 확인한다
  const [{ data: profile }, { data: consents }] = await Promise.all([
    userDb.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
    userDb.from("consents").select("purpose, policy_version").eq("user_id", userId)
      .is("revoked_at", null).in("purpose", [...REQUIRED_CONSENTS]),
  ]);
  if (profile?.account_status !== "active") {
    return { status: 403, body: { errors: { _form: "지금은 신청할 수 없는 계정이에요. 고객센터로 문의해주세요." } } };
  }
  if (!hasRequiredConsents(consents ?? [])) {
    return { status: 403, body: { errors: { _form: "필수 약관에 동의한 뒤 신청할 수 있어요." } } };
  }

  const raw = body as Partial<ApplicationDraft> | null;
  if (!raw || typeof raw !== "object" || typeof raw.idempotencyKey !== "string" || raw.idempotencyKey.length === 0) {
    return { status: 422, body: { errors: { _form: "신청서 형식이 올바르지 않아요." } } };
  }
  const draft = normalizeDraft(raw as Partial<ApplicationDraft> & { idempotencyKey: string });
  const parsed = parseSubmission(draft, now);
  if (!parsed.ok) return { status: 422, body: { errors: parsed.errors } };

  const { data: existing } = await userDb
    .from("applications").select("id").eq("user_id", userId).eq("idempotency_key", draft.idempotencyKey).maybeSingle();
  const { data, error } = await serverDb.rpc("submit_application", {
    p_user_id: userId,
    p_idempotency_key: draft.idempotencyKey,
    p_payload: parsed.value,
  });
  if (error?.code === "P0002") {
    return { status: 409, body: { errors: { _form: "지금은 신청을 받는 회차가 없어요. 다음 회차가 열리면 알려드릴게요." } } };
  }
  if (error || !data) return { status: 500, body: { errors: { _form: "신청을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." } } };
  const row = data as ApplicationRow;
  if (row.idempotency_key !== draft.idempotencyKey) {
    // 다른 신청서로 이미 진행 중인 신청이 있다. 새 답변은 저장되지 않았으니 성공처럼 보이면 안 된다.
    return {
      status: 409,
      body: {
        errors: { _form: `이미 진행 중인 신청(${row.number})이 있어요. 지금 신청이 끝난 뒤 새로 신청할 수 있어요.` },
        activeNumber: row.number,
      },
    };
  }
  return { status: 200, body: { application: toApplication(row), duplicate: Boolean(existing) } };
}

// 로그인 사용자별 Supabase 저장소. 브라우저 클라이언트로 동작하며 접근은 DB의 RLS가 막는다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDraft, type ApplicationDraft } from "@/lib/apply/schema";
import { getPlace } from "@/lib/data/places";
import type { Profile } from "@/lib/types";
import { toApplication, type ApplicationRow } from "./mapping";
import type { AppRepository, Application, CurrentUser, SubmitResult, VerificationStatus } from "./types";

export class LoginRequiredError extends Error {
  constructor() {
    super("LOGIN_REQUIRED");
  }
}

const DRAFT_DEBOUNCE_MS = 600;

export class SupabaseRepository implements AppRepository {
  readonly kind = "supabase" as const;
  private pendingDraft: ApplicationDraft | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private db: SupabaseClient) {}

  async currentUser(): Promise<CurrentUser | null> {
    const { data } = await this.db.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  }

  private async uid(): Promise<string> {
    const u = await this.currentUser();
    if (!u) throw new LoginRequiredError();
    return u.id;
  }

  async getVerificationStatus(): Promise<VerificationStatus> {
    const { data } = await this.db.from("private_profiles").select("verification_status").maybeSingle();
    return (data?.verification_status as VerificationStatus | undefined) ?? "unverified";
  }

  async getProfile(): Promise<Profile> {
    const { data } = await this.db.from("profiles").select("nickname").maybeSingle();
    return { nickname: data?.nickname ?? "" };
  }

  async updateNickname(nickname: string): Promise<Profile> {
    const n = nickname.trim();
    if (n.length < 1 || n.length > 12) throw new Error("닉네임은 1~12자로 입력해주세요.");
    const id = await this.uid();
    const { error } = await this.db.from("profiles").update({ nickname: n }).eq("id", id);
    if (error) throw new Error("닉네임을 저장하지 못했어요.");
    return { nickname: n };
  }

  async listBookmarkIds(): Promise<string[]> {
    if (!(await this.currentUser())) return [];
    const { data } = await this.db.from("bookmarks").select("place_id").order("created_at");
    return (data ?? []).map((r) => r.place_id as string).filter((id) => getPlace(id));
  }

  async setBookmark(placeId: string, saved: boolean): Promise<string[]> {
    if (!getPlace(placeId)) throw new Error("존재하지 않는 장소예요.");
    const id = await this.uid();
    const res = saved
      ? await this.db.from("bookmarks").upsert({ user_id: id, place_id: placeId }, { ignoreDuplicates: true })
      : await this.db.from("bookmarks").delete().eq("place_id", placeId);
    if (res.error) throw new Error("저장하지 못했어요.");
    return this.listBookmarkIds();
  }

  async getDraft(): Promise<ApplicationDraft | null> {
    if (!(await this.currentUser())) return null;
    const { data } = await this.db.from("application_drafts").select("data").maybeSingle();
    const raw = data?.data as (Partial<ApplicationDraft> & { idempotencyKey?: string }) | undefined;
    return raw && typeof raw.idempotencyKey === "string" ? normalizeDraft(raw as ApplicationDraft) : null;
  }

  /** 입력할 때마다 저장하지 않고 잠깐 모았다가 한 번에 저장한다 */
  async saveDraft(draft: ApplicationDraft): Promise<void> {
    this.pendingDraft = draft;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flushDraft(), DRAFT_DEBOUNCE_MS);
  }

  async flushDraft(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const draft = this.pendingDraft;
    this.pendingDraft = null;
    if (!draft) return;
    const user = await this.currentUser();
    if (!user) return;
    await this.db.from("application_drafts").upsert({ user_id: user.id, data: draft });
  }

  async clearDraft(): Promise<void> {
    this.pendingDraft = null;
    if (this.timer) clearTimeout(this.timer);
    await this.db.from("application_drafts").delete().not("user_id", "is", null);
  }

  async submitApplication(draft: ApplicationDraft): Promise<SubmitResult> {
    this.pendingDraft = null;
    if (this.timer) clearTimeout(this.timer);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = (await res.json().catch(() => null)) as
      | { application: Application; duplicate: boolean }
      | { errors: Record<string, string> }
      | null;
    if (res.ok && body && "application" in body) return { ok: true, application: body.application, duplicate: body.duplicate };
    if (body && "errors" in body) return { ok: false, errors: body.errors };
    return { ok: false, errors: { _form: "신청을 보내지 못했어요. 잠시 뒤 다시 시도해주세요." } };
  }

  async listApplications(): Promise<Application[]> {
    if (!(await this.currentUser())) return [];
    const { data } = await this.db
      .from("applications").select("id, number, status, submitted_at, idempotency_key, answers")
      .order("submitted_at", { ascending: false });
    return ((data ?? []) as ApplicationRow[]).map(toApplication);
  }

  async resetDemo(): Promise<void> {
    // 실제 데이터 모드에서는 지우지 않는다
  }
}

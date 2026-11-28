import type { ApplicationDraft, FieldErrors, SubmittedApplication } from "@/lib/apply/schema";
import type { ApplicationStatus, Profile } from "@/lib/types";

export interface Application {
  id: string;
  /** 사용자에게 보여주는 신청 번호 */
  number: string;
  status: ApplicationStatus;
  submittedAt: string;
  idempotencyKey: string;
  data: SubmittedApplication;
}

export type SubmitResult =
  | { ok: true; application: Application; duplicate: boolean }
  | { ok: false; errors: FieldErrors };

/**
 * 화면이 쓰는 데이터 접근 계약.
 * local-demo: 브라우저 localStorage 데모(LocalDemoRepository)
 * supabase: 로그인 사용자별 Supabase 저장(SupabaseRepository)
 */
export type VerificationStatus = "unverified" | "pending" | "verified";
export interface CurrentUser { id: string; email: string | null }

export interface AppRepository {
  readonly kind: "local-demo" | "supabase";
  /** 로그인 사용자. 데모 모드는 항상 가상 사용자를 돌려준다. */
  currentUser(): Promise<CurrentUser | null>;
  /** 성인·본인확인 상태. 데모 모드는 항상 "unverified". */
  getVerificationStatus(): Promise<VerificationStatus>;
  getProfile(): Promise<Profile>;
  updateNickname(nickname: string): Promise<Profile>;
  listBookmarkIds(): Promise<string[]>;
  setBookmark(placeId: string, saved: boolean): Promise<string[]>;
  getDraft(): Promise<ApplicationDraft | null>;
  saveDraft(draft: ApplicationDraft): Promise<void>;
  clearDraft(): Promise<void>;
  submitApplication(draft: ApplicationDraft): Promise<SubmitResult>;
  listApplications(): Promise<Application[]>;
  resetDemo(): Promise<void>;
}

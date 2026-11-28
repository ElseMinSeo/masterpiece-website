"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emptyDraft, type ApplicationDraft } from "@/lib/apply/schema";
import { getRepository, type Application, type CurrentUser, type SubmitResult, type VerificationStatus } from "@/lib/repo";
import { newIdempotencyKey } from "@/lib/repo/local";
import type { Profile } from "@/lib/types";

interface AppState {
  ready: boolean;
  /** 데이터 저장 방식 */
  mode: "local-demo" | "supabase";
  user: CurrentUser | null;
  verification: VerificationStatus;
  profile: Profile;
  bookmarks: string[];
  draft: ApplicationDraft | null;
  applications: Application[];
}

interface AppActions {
  isSaved(placeId: string): boolean;
  toggleBookmark(placeId: string): Promise<void>;
  /** 초안이 없으면 새로 만든다 */
  ensureDraft(): ApplicationDraft;
  updateDraft(patch: Partial<ApplicationDraft>): void;
  submit(): Promise<SubmitResult>;
  updateNickname(n: string): Promise<void>;
  resetDemo(): Promise<void>;
  /** 서버 상태를 다시 읽는다 (본인확인 상태 변경 등) */
  refresh(): Promise<void>;
}

const Ctx = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const repo = getRepository();
  const [state, setState] = useState<AppState>({
    ready: false, mode: repo.kind, user: null, verification: "unverified",
    profile: { nickname: "" }, bookmarks: [], draft: null, applications: [],
  });
  const draftRef = useRef<ApplicationDraft | null>(null);
  const bookmarksRef = useRef<string[]>([]);

  const load = useCallback(async () => {
    const [user, verification, profile, bookmarks, draft, applications] = await Promise.all([
      repo.currentUser(), repo.getVerificationStatus(), repo.getProfile(), repo.listBookmarkIds(), repo.getDraft(), repo.listApplications(),
    ]);
    draftRef.current = draft;
    bookmarksRef.current = bookmarks;
    setState({ ready: true, mode: repo.kind, user, verification, profile, bookmarks, draft, applications });
  }, [repo]);

  useEffect(() => {
    void load();
    // 다른 탭에서 바뀐 데모 데이터도 반영
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("cheotgil.demo.")) void load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  const actions = useMemo<AppActions>(() => ({
    isSaved: () => false, // 아래에서 state 기반으로 덮어씀
    async toggleBookmark(placeId) {
      if (repo.kind === "supabase" && !(await repo.currentUser())) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      const cur = bookmarksRef.current;
      const next = !cur.includes(placeId);
      const optimistic = next ? [...cur, placeId] : cur.filter((id) => id !== placeId);
      bookmarksRef.current = optimistic;
      setState((s) => ({ ...s, bookmarks: optimistic }));
      try {
        const bookmarks = await repo.setBookmark(placeId, next);
        bookmarksRef.current = bookmarks;
        setState((s) => ({ ...s, bookmarks }));
      } catch {
        await load();
      }
    },
    ensureDraft() {
      if (draftRef.current) return draftRef.current;
      const d = emptyDraft(newIdempotencyKey());
      draftRef.current = d;
      setState((s) => ({ ...s, draft: d }));
      void repo.saveDraft(d);
      return d;
    },
    updateDraft(patch) {
      const base = draftRef.current ?? emptyDraft(newIdempotencyKey());
      const d = { ...base, ...patch, updatedAt: new Date().toISOString() };
      draftRef.current = d;
      setState((s) => ({ ...s, draft: d }));
      void repo.saveDraft(d);
    },
    async submit() {
      const d = draftRef.current;
      if (!d) return { ok: false, errors: { _form: "작성 중인 신청서가 없어요." } };
      const result = await repo.submitApplication(d);
      if (result.ok) {
        draftRef.current = null;
        const applications = await repo.listApplications();
        setState((s) => ({ ...s, draft: null, applications }));
      }
      return result;
    },
    async updateNickname(n) {
      const profile = await repo.updateNickname(n);
      setState((s) => ({ ...s, profile }));
    },
    async refresh() {
      await load();
    },
    async resetDemo() {
      await repo.resetDemo();
      await load();
    },
  }), [repo, load]);

  const value = useMemo(() => ({
    ...state,
    ...actions,
    isSaved: (id: string) => state.bookmarks.includes(id),
  }), [state, actions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export const ACTIVE_STATUSES: Application["status"][] = ["submitted", "reviewing", "offered"];

export function useActiveApplication(): Application | undefined {
  const { applications } = useApp();
  return applications.find((a) => ACTIVE_STATUSES.includes(a.status));
}

export const STATUS_LABEL: Record<Application["status"], string> = {
  submitted: "운영자 검토 대기",
  reviewing: "운영자 검토 중",
  offered: "소개 도착",
  closed: "종료",
  withdrawn: "신청 취소",
};

import { dataSource } from "@/lib/env";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { LocalDemoRepository, type KeyValueStore } from "./local";
import { SupabaseRepository } from "./supabase";
import type { AppRepository } from "./types";

const memory = new Map<string, string>();
const memoryStore: KeyValueStore = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function browserStore(): KeyValueStore {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const t = "__cheotgil_probe__";
      window.localStorage.setItem(t, "1");
      window.localStorage.removeItem(t);
      return window.localStorage;
    }
  } catch {
    // 사파리 개인정보 보호 모드 등: 메모리로 대체 (새로고침 시 사라짐)
  }
  return memoryStore;
}

let instance: AppRepository | null = null;

/** NEXT_PUBLIC_DATA_SOURCE=supabase 이면 로그인 사용자별 Supabase, 아니면 브라우저 데모 저장소 */
export function getRepository(): AppRepository {
  if (!instance) {
    instance = dataSource() === "supabase"
      ? new SupabaseRepository(createBrowserSupabase())
      : new LocalDemoRepository(browserStore());
  }
  return instance;
}

export type { AppRepository, Application, CurrentUser, SubmitResult, VerificationStatus } from "./types";

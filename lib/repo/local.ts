import { normalizeDraft, parseSubmission, type ApplicationDraft } from "@/lib/apply/schema";
import { getPlace } from "@/lib/data/places";
import type { Profile } from "@/lib/types";
import type { AppRepository, Application, CurrentUser, SubmitResult, VerificationStatus } from "./types";

/** localStorage와 같은 최소 인터페이스 (테스트에서 메모리 구현으로 대체) */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "cheotgil.demo.v1.";
const K = {
  profile: PREFIX + "profile",
  bookmarks: PREFIX + "bookmarks",
  draft: PREFIX + "draft",
  applications: PREFIX + "applications",
} as const;

const ACTIVE: Application["status"][] = ["submitted", "reviewing", "offered"];

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function makeApplicationNumber(now: Date, rand: () => number = Math.random): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit" })
    .format(now).replaceAll("-", "");
  const tail = Math.floor(rand() * 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `CG-${ymd}-${tail}`;
}

export class LocalDemoRepository implements AppRepository {
  readonly kind = "local-demo" as const;
  /** 같은 탭에서 동시에 들어온 제출 요청을 하나로 합친다 */
  private inflight = new Map<string, Promise<SubmitResult>>();

  constructor(private store: KeyValueStore, private now: () => Date = () => new Date()) {}

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = this.store.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(key: string, value: unknown) {
    this.store.setItem(key, JSON.stringify(value));
  }

  async currentUser(): Promise<CurrentUser | null> {
    return { id: "local-demo-user", email: null };
  }
  async getVerificationStatus(): Promise<VerificationStatus> {
    return "unverified";
  }

  async getProfile(): Promise<Profile> {
    return this.read<Profile>(K.profile, { nickname: "데모 사용자" });
  }
  async updateNickname(nickname: string): Promise<Profile> {
    const n = nickname.trim();
    if (n.length < 1 || n.length > 12) throw new Error("닉네임은 1~12자로 입력해주세요.");
    const p = { nickname: n };
    this.write(K.profile, p);
    return p;
  }

  async listBookmarkIds(): Promise<string[]> {
    return this.read<string[]>(K.bookmarks, []).filter((id) => getPlace(id));
  }
  async setBookmark(placeId: string, saved: boolean): Promise<string[]> {
    if (!getPlace(placeId)) throw new Error("존재하지 않는 장소예요.");
    const cur = new Set(await this.listBookmarkIds());
    if (saved) cur.add(placeId);
    else cur.delete(placeId);
    const list = [...cur];
    this.write(K.bookmarks, list);
    return list;
  }

  async getDraft(): Promise<ApplicationDraft | null> {
    const raw = this.read<(Partial<ApplicationDraft> & { idempotencyKey: string }) | null>(K.draft, null);
    return raw && typeof raw.idempotencyKey === "string" ? normalizeDraft(raw) : null;
  }
  async saveDraft(draft: ApplicationDraft): Promise<void> {
    this.write(K.draft, { ...draft, updatedAt: this.now().toISOString() });
  }
  async clearDraft(): Promise<void> {
    this.store.removeItem(K.draft);
  }

  async listApplications(): Promise<Application[]> {
    return this.read<Application[]>(K.applications, []);
  }

  submitApplication(draft: ApplicationDraft): Promise<SubmitResult> {
    const key = draft.idempotencyKey;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const p = Promise.resolve().then(() => this.submitNow(draft));
    this.inflight.set(key, p);
    void p.finally(() => this.inflight.delete(key));
    return p;
  }

  /** localStorage 연산은 동기라 이 함수 안에서는 다른 제출이 끼어들지 못한다 */
  private submitNow(input: ApplicationDraft): SubmitResult {
    const draft = normalizeDraft(input);
    const apps = this.read<Application[]>(K.applications, []);
    const same = apps.find((a) => a.idempotencyKey === draft.idempotencyKey);
    if (same) return { ok: true, application: same, duplicate: true };
    const active = apps.find((a) => ACTIVE.includes(a.status));
    if (active) {
      return { ok: false, errors: { _form: `이미 진행 중인 신청(${active.number})이 있어요. 지금 신청이 끝난 뒤 새로 신청할 수 있어요.` } };
    }

    const now = this.now();
    const parsed = parseSubmission(draft, now);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    const app: Application = {
      id: randomId(),
      number: makeApplicationNumber(now),
      status: "submitted",
      submittedAt: now.toISOString(),
      idempotencyKey: draft.idempotencyKey,
      data: parsed.value,
    };
    this.write(K.applications, [app, ...apps]);
    this.store.removeItem(K.draft);
    return { ok: true, application: app, duplicate: false };
  }

  async resetDemo(): Promise<void> {
    Object.values(K).forEach((k) => this.store.removeItem(k));
  }
}

export function newIdempotencyKey(): string {
  return randomId();
}

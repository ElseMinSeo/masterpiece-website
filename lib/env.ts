// 환경 설정 읽기. NEXT_PUBLIC_* 값은 Next가 빌드 때 그대로 바꿔 넣으므로 process.env.이름 형태로만 읽는다.

export type DataSource = "local-demo" | "supabase";

/** 화면이 쓸 데이터 저장소. 기본은 브라우저 저장소 데모(local-demo). */
export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "local-demo";
}

export function supabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 .env.local 에 설정해주세요.");
  }
  return { url, anonKey };
}

/** 로컬 개발용 Supabase 주소인지. 개발 전용 기능(테스트 로그인 등)의 안전장치로 쓴다. */
export function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

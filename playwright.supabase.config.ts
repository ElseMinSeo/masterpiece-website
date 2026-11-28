import { defineConfig } from "@playwright/test";

// supabase 모드 E2E. 먼저 `npm run db:start`. 로컬 기본 키(공개 데모 키)를 쓴다.
const PORT = 3200;
const LOCAL_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export default defineConfig({
  testDir: "tests/e2e-supabase",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 375, height: 812 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NEXT_DIST_DIR: ".next-supabase",
      NEXT_PUBLIC_DATA_SOURCE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE,
      DEV_TEST_LOGIN: "1",
    },
  },
});

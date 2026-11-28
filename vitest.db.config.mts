import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 로컬 Supabase(npm run db:start)에 실제로 붙는 통합 테스트.
// 아래 키는 Supabase CLI가 모든 로컬 환경에 똑같이 쓰는 공개 데모 키이며 비밀이 아니다.
const LOCAL = {
  SUPABASE_TEST_URL: "http://127.0.0.1:54321",
  SUPABASE_TEST_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  SUPABASE_TEST_SERVICE_ROLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
};

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    env: { ...LOCAL, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("SUPABASE_TEST_"))) },
  },
});

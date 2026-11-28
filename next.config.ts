import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // supabase 모드 E2E는 데모 빌드와 섞이지 않게 다른 폴더에 빌드한다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // 개발 데모 단계: 검색엔진에 노출하지 않는다. 정식 출시 때 제거 (docs/decisions/0003)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

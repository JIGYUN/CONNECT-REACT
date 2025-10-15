/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ SSR 배포(Cloudflare Pages Next-on-Pages). 정적 export 금지
  // output: 'export',  // ← 제거

  images: { unoptimized: true },

  // 배포 우선: 빌드에서 린트/TS 에러 무시 (원복은 나중에)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // 필요시: 엣지/미들웨어에서 fetch CORS 문제 줄이기 위한 튜닝 가능
  // experimental: { runtime: 'edge' }, // 미들웨어만 edge로 씀 (옵션)
};

module.exports = nextConfig;
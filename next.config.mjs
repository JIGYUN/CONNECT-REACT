/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

const nextConfig = {
  reactStrictMode: true,

  // Cloudflare Images 미사용 가정
  images: { unoptimized: true },

  // 빌드에서 ESLint/TS 에러를 잡도록 유지
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  // /api/* → 백엔드로 프록시 (Cloudflare Pages에서도 동작)
  async rewrites() {
    if (!API_BASE) return [];
    return [{ source: '/api/:path*', destination: `${API_BASE}/:path*` }];
  },

  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
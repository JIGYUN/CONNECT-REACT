// next.config.ts
import type { NextConfig } from 'next';

/** Cloudflare Pages 정적 배포 기준 */
// dev에서도 SSR 없이 개발 가능하도록 항상 export 고정
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

module.exports = nextConfig;
export default nextConfig;
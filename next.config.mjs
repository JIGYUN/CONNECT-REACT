/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ⚠️ 절대 넣지 마세요: output: 'export'
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: { unoptimized: true },    // Next Image 사용 시 필요
};
module.exports = nextConfig;

export default nextConfig;

import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT === 'export';
const nextConfig = {
  ...(isExport ? { output: 'export' } : {}), // dev는 기본 OFF
};
module.exports = nextConfig;

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 自托管 / Docker 用 standalone 自包含输出；
  // Vercel 上用平台自带的构建产物（VERCEL=1 时跳过 standalone）。
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;

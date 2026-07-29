import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  // 自托管 / Docker 用 standalone 自包含输出；
  // Vercel 上用平台自带的构建产物（VERCEL=1 时跳过 standalone）。
  output: process.env.VERCEL ? undefined : "standalone",
  // 当前项目路径包含中文目录时，Next 16/Turbopack 的自动根目录推断容易误判。
  // 显式声明根目录，避免被 /Users/mac/package-lock.json 等上层 lockfile 干扰。
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;

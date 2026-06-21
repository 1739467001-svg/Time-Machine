import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 输出自包含的 standalone 服务，便于 Docker / 云服务器部署。
  output: "standalone",
};

export default nextConfig;

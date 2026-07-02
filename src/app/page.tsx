import { describeEngine } from "@/lib/aging";
import HomeClient from "./HomeClient";

// 依赖运行时环境变量 AGING_PROVIDER 判断当前引擎是否为云端（决定是否弹知情同意）。
// 与 /api/age 一样按请求动态渲染，确保读到部署环境（Vercel / Docker）的真实配置，
// 而不是构建期的值。
export const dynamic = "force-dynamic";

export default function Home() {
  // 服务端解析引擎元信息后注入客户端。只传「是否云端 / 厂商名」这类非敏感信息，
  // 绝不把 API Key 之类的机密下发到浏览器。
  return <HomeClient engine={describeEngine()} />;
}

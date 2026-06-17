import { GeminiAgingProvider } from "./gemini-provider";
import { MockAgingProvider } from "./mock-provider";
import type { AgingProvider } from "./types";

export type { AgedImage, AgingProvider, AgingRequest } from "./types";

/**
 * 根据环境变量 AGING_PROVIDER 选择变老引擎。
 *
 * 默认 mock —— 这样把仓库 clone 下来、不配任何 Key 也能跑通完整流程。
 * 想看真实出图效果：设 AGING_PROVIDER=gemini 并配好 GEMINI_API_KEY。
 *
 * 之后要接 SAM / FLUX / 自托管模型，只需在这里多加一个 case，
 * 实现对应的 Provider 即可，前端与 API 层都不用动。
 */
export function getAgingProvider(): AgingProvider {
  const kind = (process.env.AGING_PROVIDER ?? "mock").toLowerCase();
  switch (kind) {
    case "gemini":
      return new GeminiAgingProvider();
    case "mock":
    default:
      return new MockAgingProvider();
  }
}

import { resolveEngineKind } from "./engine-info";
import { GeminiAgingProvider } from "./gemini-provider";
import { MockAgingProvider } from "./mock-provider";
import { QwenAgingProvider } from "./qwen-provider";
import type { AgingProvider } from "./types";

export type { AgedImage, AgingProvider, AgingRequest } from "./types";
export { describeEngine, resolveEngineKind } from "./engine-info";
export type { EngineInfo, EngineKind } from "./engine-info";

/**
 * 根据环境变量 AGING_PROVIDER 选择变老引擎。
 *
 * 默认 mock —— 这样把仓库 clone 下来、不配任何 Key 也能跑通完整流程。
 * 想看真实出图效果：
 *   - AGING_PROVIDER=gemini ＋ GEMINI_API_KEY      （nano-banana）
 *   - AGING_PROVIDER=qwen   ＋ DASHSCOPE_API_KEY    （阿里云百炼 Qwen-Image-Edit）
 *
 * 之后要接 SAM / FLUX / 自托管模型，只需在这里多加一个 case，
 * 实现对应的 Provider 即可，前端与 API 层都不用动。
 */
export function getAgingProvider(): AgingProvider {
  // 引擎选择（含 bailian→qwen 归一化、未知值回落 mock）统一由 resolveEngineKind 决定，
  // 与 describeEngine() 共用同一份规则，避免两处逻辑漂移。
  switch (resolveEngineKind()) {
    case "gemini":
      return new GeminiAgingProvider();
    case "qwen":
      return new QwenAgingProvider();
    case "mock":
    default:
      return new MockAgingProvider();
  }
}

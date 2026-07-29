import { GeminiAgingProvider } from "./gemini-provider";
import { MockAgingProvider } from "./mock-provider";
import { normalizeAgingProviderKind } from "./provider-info";
import { QwenAgingProvider } from "./qwen-provider";
import { StepFunAgingProvider } from "./stepfun-provider";
import type { AgingProvider } from "./types";

export type { AgedImage, AgingProvider, AgingRequest } from "./types";
export type { AgingProviderInfo, AgingProviderKind } from "./provider-info";

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
  const kind = normalizeAgingProviderKind();
  switch (kind) {
    case "gemini":
      return new GeminiAgingProvider();
    case "qwen":
      return new QwenAgingProvider();
    case "stepfun":
      return new StepFunAgingProvider();
    case "invalid":
      throw new Error("AGING_PROVIDER 配置无效，请使用 mock、gemini、qwen 或 stepfun。");
    case "mock":
      return new MockAgingProvider();
  }
}

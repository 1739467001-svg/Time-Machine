/**
 * 变老引擎的「元信息」——只描述引擎的隐私/数据流向特征，不构造引擎、不碰 API Key。
 *
 * 为什么要和 getAgingProvider() 分开：云端 Provider 的构造函数在缺 Key 时会抛错
 * （见 gemini-provider / qwen-provider）。而前端只是想知道「当前引擎会不会把人脸
 * 传出设备」，用来决定是否弹知情同意框——这个判断必须能在**不实例化 Provider**、
 * 因而**不受缺 Key 影响**的前提下拿到，否则一个还没填 Key 的部署会直接让首页崩掉。
 *
 * 这里同时充当「AGING_PROVIDER 取值 → 引擎」的唯一事实来源：index.ts 的工厂函数
 * 也复用 resolveEngineKind()，避免两处 switch 各写各的、日后取值规则漂移。
 */

export type EngineKind = "mock" | "gemini" | "qwen";

export interface EngineInfo {
  /** 归一化后的引擎标识 */
  kind: EngineKind;
  /** 是否会把人脸上传到设备之外的第三方服务（决定是否需要知情同意） */
  cloud: boolean;
  /** 数据接收方，仅云端引擎有意义，用于知情同意文案 */
  vendor?: string;
}

const ENGINE_INFO: Record<EngineKind, EngineInfo> = {
  mock: { kind: "mock", cloud: false },
  gemini: { kind: "gemini", cloud: true, vendor: "Google（Gemini / nano-banana）" },
  qwen: { kind: "qwen", cloud: true, vendor: "阿里云百炼（DashScope）" },
};

/**
 * 把 AGING_PROVIDER 的原始取值归一化为引擎标识。
 * 未知值一律回落到本地占位引擎 mock —— 与工厂函数的兜底行为保持一致。
 */
export function resolveEngineKind(raw: string | undefined = process.env.AGING_PROVIDER): EngineKind {
  switch ((raw ?? "mock").toLowerCase()) {
    case "gemini":
      return "gemini";
    case "qwen":
    case "bailian":
      return "qwen";
    case "mock":
    default:
      return "mock";
  }
}

/** 读取当前部署配置的引擎元信息（供服务端注入前端，用于知情同意判断）。 */
export function describeEngine(): EngineInfo {
  return ENGINE_INFO[resolveEngineKind()];
}

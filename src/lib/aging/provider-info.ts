export type AgingProviderKind = "mock" | "gemini" | "qwen" | "stepfun" | "invalid";

export interface AgingProviderInfo {
  kind: AgingProviderKind;
  displayName: string;
  vendor: string;
  cloud: boolean;
  requiresConsent: boolean;
  privacyNotice: string;
  envKeys: string[];
  ready: boolean;
  configurationError?: string;
}

export interface QwenConfigurationStatus {
  ready: boolean;
  error?: string;
}

export function normalizeAgingProviderKind(
  value = process.env.AGING_PROVIDER ?? "mock",
): AgingProviderKind {
  const kind = value.trim().toLowerCase();
  if (!kind || kind === "mock") return "mock";
  if (kind === "gemini") return "gemini";
  if (kind === "qwen" || kind === "bailian" || kind === "dashscope") return "qwen";
  if (kind === "stepfun" || kind === "step") return "stepfun";
  return "invalid";
}

export function getAgingProviderInfo(
  kind = normalizeAgingProviderKind(),
): AgingProviderInfo {
  switch (kind) {
    case "gemini": {
      const geminiReady = Boolean(process.env.GEMINI_API_KEY?.trim());
      return {
        kind: "gemini",
        displayName: "Gemini / nano-banana",
        vendor: "Google",
        cloud: true,
        requiresConsent: true,
        privacyNotice:
          "生成时会把本次抓拍的人脸照片上传至 Google Gemini API，仅用于本次图像编辑请求。",
        envKeys: ["AGING_PROVIDER", "GEMINI_API_KEY", "GEMINI_IMAGE_MODEL"],
        ready: geminiReady,
        configurationError: geminiReady ? undefined : "缺少 GEMINI_API_KEY。",
      };
    }
    case "qwen": {
      const configuration = getQwenConfigurationStatus();
      return {
        kind: "qwen",
        displayName: "Qwen-Image-Edit / 百炼",
        vendor: "阿里云百炼",
        cloud: true,
        requiresConsent: true,
        privacyNotice:
          "生成时会把本次抓拍的人脸照片上传至阿里云百炼 DashScope，仅用于本次图像编辑请求。",
        envKeys: [
          "AGING_PROVIDER",
          "DASHSCOPE_API_KEY",
          "DASHSCOPE_REGION",
          "DASHSCOPE_BASE_URL",
          "QWEN_IMAGE_MODEL",
        ],
        ready: configuration.ready,
        configurationError: configuration.error,
      };
    }
    case "stepfun": {
      const ready = Boolean(process.env.STEPFUN_API_KEY?.trim());
      return {
        kind: "stepfun",
        displayName: "StepFun / step-image-edit-2",
        vendor: "阶跃星辰",
        cloud: true,
        requiresConsent: true,
        privacyNotice:
          "生成时会把本次抓拍的人脸照片上传至 StepFun，仅用于本次图像编辑请求。",
        envKeys: ["AGING_PROVIDER", "STEPFUN_API_KEY", "STEPFUN_BASE_URL", "STEPFUN_IMAGE_MODEL"],
        ready,
        configurationError: ready ? undefined : "缺少 STEPFUN_API_KEY。",
      };
    }
    case "invalid":
      return {
        kind: "invalid",
        displayName: "未识别的变老引擎",
        vendor: "未配置",
        cloud: false,
        requiresConsent: false,
        privacyNotice: "当前变老引擎配置无效，无法开始拍摄或生成。",
        envKeys: ["AGING_PROVIDER"],
        ready: false,
        configurationError: `不支持 AGING_PROVIDER=${configuredProviderValue()}。可用值：mock、gemini、qwen、stepfun。`,
      };
    case "mock":
      return {
        kind: "mock",
        displayName: "本地 mock 占位引擎",
        vendor: "本机浏览器",
        cloud: false,
        requiresConsent: false,
        privacyNotice:
          "当前使用本地占位引擎，不调用第三方 AI；照片只在本次流程中以内存数据处理。",
        envKeys: ["AGING_PROVIDER"],
        ready: true,
      };
  }
}

function configuredProviderValue(): string {
  return process.env.AGING_PROVIDER?.trim() || "(未设置)";
}

export function getQwenConfigurationStatus(
  env: NodeJS.ProcessEnv = process.env,
): QwenConfigurationStatus {
  const apiKey = env.DASHSCOPE_API_KEY?.trim() ?? "";
  const baseUrl = env.DASHSCOPE_BASE_URL?.trim() ?? "";

  if (!apiKey) {
    return { ready: false, error: "缺少 DASHSCOPE_API_KEY。" };
  }
  if (apiKey.startsWith("sk-sp-")) {
    return {
      ready: false,
      error:
        "当前是 Token Plan / Coding Plan 专属密钥，不能用于此图像编辑接口。请创建百炼按量付费业务空间 API Key。",
    };
  }
  if (!apiKey.startsWith("sk-")) {
    return { ready: false, error: "DASHSCOPE_API_KEY 格式不正确。" };
  }
  if (apiKey.startsWith("sk-ws") && !baseUrl) {
    return {
      ready: false,
      error:
        "新版业务空间 API Key 还需要 DASHSCOPE_BASE_URL，请填写创建密钥时显示的 API Host。",
    };
  }
  if (baseUrl && !isHttpsUrl(baseUrl)) {
    return { ready: false, error: "DASHSCOPE_BASE_URL 必须是有效的 HTTPS API Host。" };
  }
  return { ready: true };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

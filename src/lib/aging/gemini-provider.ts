import { buildAgingPrompt } from "./prompt";
import type { AgedImage, AgingProvider, AgingRequest } from "./types";

/**
 * nano-banana（Gemini 2.5 Flash Image）变老引擎 —— 参考实现。
 *
 * 这是「出图效果优先」路线的主引擎：把源人脸和一句「变老 N 年」的提示词
 * 一起发给 Gemini 图像编辑模型，得到照片级、且保持身份的老年照。
 *
 * ⚠️ 启用前请注意：
 *  1. 需要环境变量 GEMINI_API_KEY（在 https://aistudio.google.com 申请）。
 *  2. 模型名与请求/响应结构请对照最新官方文档校验：
 *     https://ai.google.dev/gemini-api/docs/image-generation
 *  3. 人脸会上传到 Google —— 隐私上必须在 UI 明确告知用户并取得同意。
 *
 * 设为默认引擎的方式：在 .env.local 里 AGING_PROVIDER=gemini。
 */
export class GeminiAgingProvider implements AgingProvider {
  readonly name = "gemini";

  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GeminiAgingProvider 需要环境变量 GEMINI_API_KEY；请在 .env.local 配置后再把 AGING_PROVIDER 设为 gemini。",
      );
    }
    this.apiKey = apiKey;
    this.model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  }

  async age({ imageDataUrl, step }: AgingRequest): Promise<AgedImage> {
    const { mimeType, base64 } = parseDataUrl(imageDataUrl);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildAgingPrompt(step) },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        // 显式要求图像输出，否则图像模型可能只返回文字描述。
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini 请求失败 ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as GeminiResponse;
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData) {
      throw new Error("Gemini 响应中未找到图像数据");
    }

    const outMime = imagePart.inlineData.mimeType ?? "image/png";
    return {
      stepId: step.id,
      yearsFromNow: step.yearsFromNow,
      label: step.label,
      imageUrl: `data:${outMime};base64,${imagePart.inlineData.data}`,
      placeholder: false,
    };
  }
}

/** Gemini generateContent 响应中我们关心的部分 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error("源图必须是 base64 data URL");
  }
  return { mimeType: match[1], base64: match[2] };
}

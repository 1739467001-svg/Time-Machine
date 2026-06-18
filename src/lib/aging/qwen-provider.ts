import { buildAgingPrompt } from "./prompt";
import type { AgedImage, AgingProvider, AgingRequest } from "./types";

const REGION_BASE: Record<string, string> = {
  cn: "https://dashscope.aliyuncs.com",
  intl: "https://dashscope-intl.aliyuncs.com",
};

/**
 * 阿里云百炼（DashScope）Qwen-Image-Edit 变老引擎 —— 参考实现。
 *
 * 指令式图像编辑：把源人脸 + 一句「变老 N 年」的指令发给 qwen-image-edit，
 * 返回编辑后的人像。是 nano-banana 之外的另一条「出图效果优先」路线。
 *
 * ⚠️ 启用前请注意：
 *  1. 需要环境变量 DASHSCOPE_API_KEY（百炼控制台申请；图像模型需已开通/计费）。
 *  2. 北京与新加坡地域的 key 与地址独立、不可混用，用 DASHSCOPE_REGION 指定。
 *  3. 请求/响应结构请对照最新官方文档校验：
 *     https://help.aliyun.com/zh/model-studio/qwen-image-edit-api
 *  4. 人脸会上传到阿里云 —— 隐私上必须在 UI 明确告知并取得同意。
 *
 * 设为默认引擎：在 .env.local 里 AGING_PROVIDER=qwen。
 */
export class QwenAgingProvider implements AgingProvider {
  readonly name = "qwen";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "QwenAgingProvider 需要环境变量 DASHSCOPE_API_KEY；请在 .env.local 配置后再把 AGING_PROVIDER 设为 qwen。",
      );
    }
    this.apiKey = apiKey;
    const region = (process.env.DASHSCOPE_REGION ?? "intl").toLowerCase();
    this.baseUrl =
      process.env.DASHSCOPE_BASE_URL ?? REGION_BASE[region] ?? REGION_BASE.intl;
    this.model = process.env.QWEN_IMAGE_MODEL ?? "qwen-image-edit";
  }

  async age({ imageDataUrl, step }: AgingRequest): Promise<AgedImage> {
    const endpoint = `${this.baseUrl}/api/v1/services/aigc/multimodal-generation/generation`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: {
          messages: [
            {
              role: "user",
              content: [{ image: imageDataUrl }, { text: buildAgingPrompt(step) }],
            },
          ],
        },
        parameters: { n: 1, watermark: false, prompt_extend: false },
      }),
    });

    const json = (await res.json()) as DashScopeResponse;
    if (!res.ok || json.code) {
      throw new Error(
        `百炼请求失败 ${res.status} ${json.code ?? ""}: ${
          json.message ?? JSON.stringify(json).slice(0, 300)
        }`,
      );
    }

    // 取出返回的图（多模态结构优先，兼容旧的 results 结构）。
    const content = json.output?.choices?.[0]?.message?.content ?? [];
    const imgRef = content.find((c) => c.image)?.image ?? json.output?.results?.[0]?.url;
    if (!imgRef) {
      throw new Error("百炼响应中未找到图像数据");
    }

    // 结果可能是临时 URL（24h 有效），统一转成 data URL：稳定、且不依赖外链。
    const imageUrl = await toDataUrl(imgRef);

    return {
      stepId: step.id,
      yearsFromNow: step.yearsFromNow,
      label: step.label,
      imageUrl,
      placeholder: false,
    };
  }
}

/** DashScope multimodal-generation 响应中我们关心的部分 */
interface DashScopeResponse {
  code?: string;
  message?: string;
  output?: {
    choices?: Array<{
      message?: { content?: Array<{ image?: string; text?: string }> };
    }>;
    results?: Array<{ url?: string }>;
  };
}

/** 把远程图片 URL 下载并转为 base64 data URL；已是 data URL 则原样返回。 */
async function toDataUrl(ref: string): Promise<string> {
  if (ref.startsWith("data:")) return ref;
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`下载结果图失败 ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

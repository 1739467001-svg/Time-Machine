import { buildAgingPrompt } from "./prompt";
import { fetchWithRetry, readJsonResponse } from "./request";
import type { AgedImage, AgingProvider, AgingRequest } from "./types";

const DEFAULT_BASE_URL = "https://api.stepfun.com/step_plan/v1";

/**
 * StepFun Step Plan 图像编辑 Provider。
 *
 * Step Plan 的图像模型使用 /images/edits multipart 接口，不能直接套用
 * OpenAI-compatible chat/completions。结果 URL 会在服务端立即转为 data URL，
 * 避免临时签名链接在时间轴展示期间过期。
 */
export class StepFunAgingProvider implements AgingProvider {
  readonly name = "stepfun";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.STEPFUN_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("缺少 STEPFUN_API_KEY。");
    }
    this.apiKey = apiKey;
    this.baseUrl = (process.env.STEPFUN_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = process.env.STEPFUN_IMAGE_MODEL ?? "step-image-edit-2";
  }

  async age({ imageDataUrl, step, sourceYearsFromNow = 0, currentAge = 20 }: AgingRequest): Promise<AgedImage> {
    const { mimeType, bytes } = parseDataUrl(imageDataUrl);
    const form = new FormData();
    form.append("model", this.model);
    const imageBuffer = new Uint8Array(bytes.byteLength);
    imageBuffer.set(bytes);
    form.append(
      "image",
      new Blob([imageBuffer.buffer as ArrayBuffer], { type: mimeType }),
      `time-machine.${extensionFor(mimeType)}`,
    );
    form.append("prompt", buildAgingPrompt(step, sourceYearsFromNow, currentAge));

    const res = await fetchWithRetry(`${this.baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    const json = await readJsonResponse<StepFunResponse>(res, "StepFun");
    if (!res.ok || json.error) {
      throw new Error(
        `StepFun 请求失败 ${res.status}: ${json.error?.message ?? "未知错误"}`,
      );
    }

    const imageRef = json.data?.[0];
    if (!imageRef) throw new Error("StepFun 响应中未找到图像");
    const imageUrl = imageRef.b64_json
      ? `data:image/png;base64,${imageRef.b64_json}`
      : imageRef.url
        ? await toDataUrl(imageRef.url)
        : "";
    if (!imageUrl) throw new Error("StepFun 响应中未找到可用图像地址");

    return {
      stepId: step.id,
      yearsFromNow: step.yearsFromNow,
      label: step.label,
      imageUrl,
      placeholder: false,
    };
  }
}

interface StepFunResponse {
  error?: { message?: string };
  data?: Array<{ url?: string; b64_json?: string; finish_reason?: string }>;
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const match = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("源图必须是 base64 data URL");
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`下载 StepFun 结果图失败 ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

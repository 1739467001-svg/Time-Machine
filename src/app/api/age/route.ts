import { NextResponse } from "next/server";
import { AGE_STEPS } from "@/lib/ages";
import { getAgingProvider } from "@/lib/aging";

// 始终动态执行（依赖运行时环境变量与请求体），不做静态缓存。
export const dynamic = "force-dynamic";
// 走 Node.js 运行时：Qwen Provider 用到 Buffer 等 Node API，Edge 没有。
export const runtime = "nodejs";
// 图像生成较慢，放宽无服务器函数超时（Vercel 等平台会读取此值，单位秒）。
export const maxDuration = 60;

// base64 字符串长度上限（约 6MB 解码后），防止超大上传。
const MAX_IMAGE_CHARS = 8_000_000;

interface AgeRequestBody {
  image?: string;
  stepId?: string;
  sourceYearsFromNow?: number;
  currentAge?: number;
}

/**
 * 生成「单个年龄段」的变老结果。
 *
 * 单段接口支持前端「逐张加载」；当前流程会把上一年龄段的输出作为下一段输入，
 * 形成连续时间轨迹，失败时从最近一个成功阶段继续重试。
 */
export async function POST(request: Request) {
  let body: AgeRequestBody;
  try {
    body = (await request.json()) as AgeRequestBody;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const { image, stepId, sourceYearsFromNow = 0, currentAge = 20 } = body;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "缺少有效的 image 字段（应为 base64 data URL）" },
      { status: 400 },
    );
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "图片过大" }, { status: 413 });
  }

  // 只允许未来年龄段（排除「现在」）
  const step = AGE_STEPS.find((s) => s.id === stepId && s.yearsFromNow > 0);
  if (!step) {
    return NextResponse.json({ error: "未知的年龄段" }, { status: 400 });
  }
  if (
    !Number.isInteger(sourceYearsFromNow) ||
    sourceYearsFromNow < 0 ||
    sourceYearsFromNow >= step.yearsFromNow
  ) {
    return NextResponse.json({ error: "无效的年龄轨迹基线" }, { status: 400 });
  }
  if (!Number.isInteger(currentAge) || currentAge < 1 || currentAge > 100) {
    return NextResponse.json({ error: "当前年龄必须是 1 到 100 之间的整数" }, { status: 400 });
  }

  try {
    const provider = getAgingProvider();
    const result = await provider.age({ imageDataUrl: image, step, sourceYearsFromNow, currentAge });
    // 隐私：源图与结果只在内存中处理，请求结束即丢弃 —— 不落盘、不入库、不打日志。
    return NextResponse.json({ provider: provider.name, result });
  } catch (err) {
    const message = toPublicError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function toPublicError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (/Token Plan|Coding Plan|sk-sp-/i.test(message)) {
    return "当前密钥类型不支持 Qwen 图像编辑，请使用百炼按量付费业务空间 API Key。";
  }
  if (/DASHSCOPE_BASE_URL|API Host/i.test(message)) {
    return "百炼业务空间 API Host 未配置或无效。";
  }
  if (/STEPFUN_API_KEY/i.test(message)) {
    return "StepFun 图像服务未配置 API Key。";
  }
  if (/InvalidApiKey|API-key|鉴权|unauthori[sz]ed/i.test(message)) {
    return "云端图像服务鉴权失败，请检查服务器配置。";
  }
  if (/timeout|timed out/i.test(message)) {
    return "图像生成超时，请重试。";
  }
  return "图像生成失败，请重试。";
}

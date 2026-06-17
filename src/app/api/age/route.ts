import { NextResponse } from "next/server";
import { FUTURE_AGE_STEPS } from "@/lib/ages";
import { getAgingProvider, type AgedImage } from "@/lib/aging";

// 始终动态执行（依赖运行时环境变量与请求体），不做静态缓存。
export const dynamic = "force-dynamic";

// base64 字符串长度上限（约 6MB 解码后），防止超大上传。
const MAX_IMAGE_CHARS = 8_000_000;

interface AgeRequestBody {
  image?: string;
}

export async function POST(request: Request) {
  let body: AgeRequestBody;
  try {
    body = (await request.json()) as AgeRequestBody;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const { image } = body;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "缺少有效的 image 字段（应为 base64 data URL）" },
      { status: 400 },
    );
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "图片过大" }, { status: 413 });
  }

  const provider = getAgingProvider();

  try {
    // 6 个未来年龄段并行生成
    const results: AgedImage[] = await Promise.all(
      FUTURE_AGE_STEPS.map((step) => provider.age({ imageDataUrl: image, step })),
    );

    // 隐私：源图与结果只在内存中处理，请求结束即丢弃 —— 不落盘、不入库、不打日志。
    return NextResponse.json({ provider: provider.name, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "变老处理失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

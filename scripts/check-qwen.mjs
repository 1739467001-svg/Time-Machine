#!/usr/bin/env node
// 百炼 / DashScope（Qwen-Image-Edit）连通性 & 鉴权自检脚本。
//
// 用途：在**有外网的机器上**快速确认你的 DASHSCOPE_API_KEY 能不能用、地域对不对、
// 图像编辑模型是否已开通——即 PRD 里 M1「技术验证 spike」的第一步。
// 它复刻了 src/lib/aging/qwen-provider.ts 的请求结构，所以能跑通它 ≈ 应用里的 qwen 引擎也能跑通。
//
// 用法：
//   DASHSCOPE_API_KEY=sk-xxx node scripts/check-qwen.mjs               # 用内置测试图，只验证鉴权/开通
//   DASHSCOPE_API_KEY=sk-xxx DASHSCOPE_REGION=cn node scripts/check-qwen.mjs
//   DASHSCOPE_API_KEY=sk-xxx node scripts/check-qwen.mjs ./face.jpg    # 用真实照片，产出图存到 ./qwen-out.png
//
// 环境变量（与应用一致）：
//   DASHSCOPE_API_KEY   必填
//   DASHSCOPE_REGION    cn=北京 / intl=新加坡（默认 intl）。两地 key 不通用！
//   QWEN_IMAGE_MODEL    默认 qwen-image-edit
//   DASHSCOPE_BASE_URL  可选，覆盖地域推导出的基址
//
// ⚠️ 脚本从环境变量读 key，绝不写入任何文件；请勿把 key 写进代码或提交。

import { readFile, writeFile } from "node:fs/promises";
import zlib from "node:zlib";

const REGION_BASE = {
  cn: "https://dashscope.aliyuncs.com",
  intl: "https://dashscope-intl.aliyuncs.com",
};

function makeTestPng(w = 64, h = 64) {
  // 纯 Node 生成一张合法的小 PNG（渐变），免依赖，供无真实照片时做鉴权自检。
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter byte
    for (let x = 0; x < w; x++) {
      raw[p++] = (x * 4) & 255;
      raw[p++] = (y * 4) & 255;
      raw[p++] = 128;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const png = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function buildAgingPrompt(years) {
  // 与 src/lib/aging/prompt.ts 一致的提示词。
  return [
    `Re-age the person in this photo to look ${years} years older than they are now.`,
    "Preserve the same identity, face shape, ethnicity, gender, hairstyle structure and pose.",
    "Add realistic, age-appropriate changes: wrinkles, skin texture, age spots, thinning and graying hair, subtle sagging.",
    "Output a photorealistic head-and-shoulders portrait with natural lighting and a neutral background.",
  ].join(" ");
}

async function toDataUrl(pathOrNull) {
  if (!pathOrNull) return makeTestPng();
  const buf = await readFile(pathOrNull);
  const ext = pathOrNull.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${ext};base64,${buf.toString("base64")}`;
}

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error("✗ 缺少 DASHSCOPE_API_KEY 环境变量。");
    console.error("  用法：DASHSCOPE_API_KEY=sk-xxx node scripts/check-qwen.mjs [可选:图片路径]");
    process.exit(2);
  }

  const region = (process.env.DASHSCOPE_REGION ?? "intl").toLowerCase();
  const baseUrl =
    process.env.DASHSCOPE_BASE_URL ?? REGION_BASE[region] ?? REGION_BASE.intl;
  const model = process.env.QWEN_IMAGE_MODEL ?? "qwen-image-edit";
  const imagePath = process.argv[2] || null;
  const endpoint = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`;

  console.log("== 百炼 / DashScope 自检 ==");
  console.log("  region  :", region, `(${baseUrl})`);
  console.log("  model   :", model);
  console.log("  key     :", apiKey.slice(0, 6) + "…" + apiKey.slice(-4));
  console.log("  image   :", imagePath ?? "（内置测试图）");
  console.log("  发起请求…\n");

  const imageDataUrl = await toDataUrl(imagePath);

  let res, json;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [{ image: imageDataUrl }, { text: buildAgingPrompt(30) }],
            },
          ],
        },
        parameters: { n: 1, watermark: false, prompt_extend: false },
      }),
    });
  } catch (err) {
    console.error("✗ 网络请求失败（连不上 DashScope）：", err?.message ?? err);
    console.error("  如果在受限网络/沙箱里，说明该环境不允许访问 dashscope，请换有外网的机器。");
    process.exit(1);
  }

  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  console.log("  HTTP", res.status, res.statusText);
  if (json?.request_id) console.log("  request_id:", json.request_id);

  // 鉴权 / 权限类错误的友好提示
  if (res.status === 401 || json?.code === "InvalidApiKey") {
    console.error("\n✗ 鉴权失败：key 无效，或与所选地域不匹配。");
    console.error("  → 确认 key 没抄错；北京(cn)与新加坡(intl)的 key 各自独立，试试切换 DASHSCOPE_REGION。");
    process.exit(1);
  }
  if (!res.ok || json?.code) {
    console.error("\n✗ 请求被拒绝：", json?.code ?? res.status, "-", json?.message ?? text.slice(0, 400));
    if (/model|not.*(exist|found|access)|open|activat/i.test(String(json?.message))) {
      console.error("  → 多半是该图像模型未开通/未计费，去百炼控制台开通 qwen-image-edit 后重试。");
    }
    process.exit(1);
  }

  // 成功：取出返回图
  const content = json?.output?.choices?.[0]?.message?.content ?? [];
  const imgRef = content.find((c) => c.image)?.image ?? json?.output?.results?.[0]?.url;
  if (!imgRef) {
    console.error("\n⚠ 请求成功，但响应里没找到图像。原始响应片段：");
    console.error("  " + text.slice(0, 500));
    process.exit(1);
  }

  console.log("\n✓ 成功！key 可用、地域正确、图像模型已开通。");

  // 把结果落盘，方便肉眼看变老质量
  const outPath = "qwen-out.png";
  let bytes;
  if (imgRef.startsWith("data:")) {
    bytes = Buffer.from(imgRef.split(",")[1], "base64");
  } else {
    console.log("  结果是临时 URL：", imgRef.slice(0, 80) + "…");
    const r = await fetch(imgRef);
    bytes = Buffer.from(await r.arrayBuffer());
  }
  await writeFile(outPath, bytes);
  console.log(`  产出图已保存到 ./${outPath}（${bytes.length} 字节）——` +
    (imagePath ? "用真实照片时可肉眼确认变老效果。" : "这是用测试图跑的，要看真实效果请传入一张人脸照片。"));
}

main().catch((e) => {
  console.error("✗ 未预期错误：", e);
  process.exit(1);
});

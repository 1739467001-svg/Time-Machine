import { agingFilter } from "@/lib/aging-filter";

/** 合成长图所需的单张卡片信息 */
export interface TimelineCard {
  label: string;
  yearsFromNow: number;
  imageUrl: string;
  placeholder: boolean;
  intensity?: number;
}

// 布局常量（单位 px）
const CELL = 320; // 每张图边长
const LABEL_H = 46; // 标签区高度
const GAP = 16;
const PAD = 32;
const TITLE_H = 76;
const FOOTER_H = 40;
const BG = "#0a0a0f";

/**
 * 把「现在 + 各年龄段」拼成一张可下载/分享的长图。
 * 标题 + 网格（每格一张带标签的人像）+ 底部免责声明。
 */
export async function composeTimeline(cards: TimelineCard[]): Promise<Blob> {
  const images = await Promise.all(cards.map((c) => loadImage(c.imageUrl)));

  const cols = Math.min(4, cards.length);
  const rows = Math.ceil(cards.length / cols);
  const width = PAD * 2 + cols * CELL + (cols - 1) * GAP;
  const height =
    PAD * 2 + TITLE_H + rows * (CELL + LABEL_H) + (rows - 1) * GAP + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  // 背景
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // 标题
  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 40px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("时光机 · 我的人生时间轴", PAD, PAD);

  // 网格
  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (CELL + GAP);
    const y = PAD + TITLE_H + row * (CELL + LABEL_H + GAP);

    ctx.save();
    ctx.filter =
      card.placeholder && card.intensity ? agingFilter(card.intensity) : "none";
    drawCover(ctx, images[i], x, y, CELL, CELL);
    ctx.restore();

    if (card.placeholder && card.intensity) {
      drawMockAgingTexture(ctx, x, y, CELL, CELL, card.intensity);
    }

    // 标签
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 24px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText(card.label, x, y + CELL + 10);
  });

  // 底部免责声明
  ctx.fillStyle = "#71717a";
  ctx.font = "20px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(
    "AI 样貌推演，仅供娱乐，非科学预测",
    PAD,
    height - PAD - 20,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("导出失败"))),
      "image/png",
    );
  });
}

/** 把图片按 cover 方式裁剪绘制到指定方框 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

function drawMockAgingTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  intensity: number,
) {
  ctx.save();
  ctx.globalAlpha = 0.12 + intensity * 0.28;

  // 顶部银灰层：让头发区域在占位模式下有更明显的年龄递进。
  const hair = ctx.createLinearGradient(x, y, x, y + h * 0.38);
  hair.addColorStop(0, `rgba(235, 239, 226, ${0.28 * intensity})`);
  hair.addColorStop(0.6, "rgba(235, 239, 226, 0)");
  ctx.fillStyle = hair;
  ctx.fillRect(x, y, w, h * 0.42);

  // 横向细纹：模拟皮肤纹理与皱纹，不做脸部识别，保持演示用的克制效果。
  ctx.strokeStyle = `rgba(38, 22, 14, ${0.28 * intensity})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const yy = y + h * (0.24 + i * 0.052);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, yy);
    ctx.quadraticCurveTo(x + w * 0.5, yy + (i % 2 ? 4 : -3), x + w * 0.8, yy + 1);
    ctx.stroke();
  }

  // 年龄斑：确定性分布，导出同一张图时不会闪烁。
  ctx.fillStyle = `rgba(75, 42, 20, ${0.22 * intensity})`;
  for (let i = 0; i < 28; i += 1) {
    const px = x + w * deterministic(i, 0.17);
    const py = y + h * (0.18 + deterministic(i, 0.41) * 0.62);
    const r = 0.8 + deterministic(i, 0.73) * 1.9 * intensity;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(
    x + w * 0.5,
    y + h * 0.45,
    w * 0.12,
    x + w * 0.5,
    y + h * 0.5,
    w * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, `rgba(18, 12, 8, ${0.28 * intensity})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}

function deterministic(index: number, salt: number) {
  return Math.abs(Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1;
}

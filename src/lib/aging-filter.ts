/**
 * 由 intensity（0..1）计算「变老」视觉滤镜字符串。
 *
 * 仅用于 mock 占位引擎：在没有真实 AI 出图时，让时间轴也能看出「逐渐变老」
 * 的趋势。该字符串可直接用于 CSS `filter` 或 Canvas `ctx.filter`，因此
 * 卡片展示与长图导出能共用同一套效果。
 * 接入真实模型后 placeholder=false，不再套用。
 */
export function agingFilter(intensity: number): string {
  const sepia = (0.45 * intensity).toFixed(2);
  const grayscale = (0.35 * intensity).toFixed(2);
  const contrast = (1 + 0.1 * intensity).toFixed(2);
  const brightness = (1 - 0.12 * intensity).toFixed(2);
  return `sepia(${sepia}) grayscale(${grayscale}) contrast(${contrast}) brightness(${brightness})`;
}

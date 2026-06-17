import type { AgedImage } from "@/lib/aging";

interface ResultCardProps {
  result: AgedImage;
}

/**
 * 由 intensity 计算「变老」视觉滤镜 —— 仅用于 mock 占位引擎，
 * 让没有真实 AI 时时间轴也能看出「逐渐变老」的趋势。
 * 接入真实模型后 placeholder=false，不再套滤镜。
 */
function agingFilter(intensity: number): string {
  const sepia = (0.45 * intensity).toFixed(2);
  const grayscale = (0.35 * intensity).toFixed(2);
  const contrast = (1 + 0.1 * intensity).toFixed(2);
  const brightness = (1 - 0.12 * intensity).toFixed(2);
  return `sepia(${sepia}) grayscale(${grayscale}) contrast(${contrast}) brightness(${brightness})`;
}

export default function ResultCard({ result }: ResultCardProps) {
  const isNow = result.yearsFromNow === 0;
  const filter =
    result.placeholder && result.intensity ? agingFilter(result.intensity) : undefined;

  return (
    <figure className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        {/* 结果是动态尺寸的 data URL，用原生 img 更合适；故关闭 next/image 规则 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.imageUrl}
          alt={result.label}
          style={{ filter }}
          className="h-full w-full object-cover"
        />
        {isNow && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-black">
            现在
          </span>
        )}
        {result.placeholder && !isNow && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-zinc-300">
            占位预览
          </span>
        )}
      </div>
      <figcaption className="flex items-baseline justify-between px-3 py-2">
        <span className="text-sm font-semibold text-white">{result.label}</span>
        {!isNow && (
          <span className="text-xs text-zinc-400">+{result.yearsFromNow} 岁</span>
        )}
      </figcaption>
    </figure>
  );
}

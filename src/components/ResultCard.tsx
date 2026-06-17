import { agingFilter } from "@/lib/aging-filter";
import type { AgedImage } from "@/lib/aging";

export type CardStatus = "pending" | "done" | "error";

interface ResultCardProps {
  label: string;
  yearsFromNow: number;
  status: CardStatus;
  result?: AgedImage;
  /** 失败时的重试回调（「现在」卡片不需要） */
  onRetry?: () => void;
}

export default function ResultCard({
  label,
  yearsFromNow,
  status,
  result,
  onRetry,
}: ResultCardProps) {
  const isNow = yearsFromNow === 0;
  const filter =
    result?.placeholder && result.intensity ? agingFilter(result.intensity) : undefined;

  return (
    <figure className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        {status === "done" && result && (
          // 结果是动态尺寸的 data URL，用原生 img 更合适；故关闭 next/image 规则
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.imageUrl}
            alt={label}
            style={{ filter }}
            className="fade-in h-full w-full object-cover"
          />
        )}

        {status === "pending" && (
          <div className="flex h-full w-full animate-pulse items-center justify-center bg-white/5">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-emerald-400" />
          </div>
        )}

        {status === "error" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
            <p className="text-xs text-rose-300">生成失败</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:bg-white/10"
              >
                重试
              </button>
            )}
          </div>
        )}

        {isNow && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-black">
            现在
          </span>
        )}
        {result?.placeholder && !isNow && status === "done" && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-zinc-300">
            占位预览
          </span>
        )}
      </div>

      <figcaption className="flex items-baseline justify-between px-3 py-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        {!isNow && <span className="text-xs text-zinc-400">+{yearsFromNow} 岁</span>}
      </figcaption>
    </figure>
  );
}

import type { CSSProperties } from "react";
import { agingFilter } from "@/lib/aging-filter";
import type { AgedImage } from "@/lib/aging";

export type CardStatus = "pending" | "done" | "error";

interface ResultCardProps {
  label: string;
  yearsFromNow: number;
  status: CardStatus;
  result?: AgedImage;
  error?: string;
  onRetry?: () => void;
  sequence?: number;
}

export default function ResultCard({
  label,
  yearsFromNow,
  status,
  result,
  error,
  onRetry,
  sequence = 0,
}: ResultCardProps) {
  const isNow = yearsFromNow === 0;
  const filter =
    result?.placeholder && result.intensity ? agingFilter(result.intensity) : undefined;
  const statusLabel = getStatusLabel(status, isNow, result?.placeholder);
  const agingIntensity = result?.placeholder ? result.intensity ?? 0 : 0;
  const agingOverlayStyle = {
    "--age-opacity": (0.25 + agingIntensity * 0.62).toFixed(2),
    "--age-spot-a": (agingIntensity * 0.2).toFixed(3),
    "--age-spot-b": (agingIntensity * 0.22).toFixed(3),
    "--age-spot-c": (agingIntensity * 0.18).toFixed(3),
    "--age-line-a": (agingIntensity * 0.16).toFixed(3),
    "--age-wrinkle-a": (agingIntensity * 0.82).toFixed(3),
    "--age-silver-a": (agingIntensity * 0.22).toFixed(3),
    "--age-screen-a": (agingIntensity * 0.42).toFixed(3),
  } as CSSProperties;

  return (
    <figure
      className={`time-slice-card is-${status}`}
      style={{ "--slice-index": sequence } as CSSProperties}
    >
      <div className="slice-header">
        <span>{label}</span>
        <strong>{isNow ? "BASELINE" : `+${yearsFromNow} YEARS`}</strong>
      </div>

      <div className="slice-image">
        {status === "done" && result && (
          // 结果是动态尺寸的 data URL，用原生 img 更合适；故关闭 next/image 规则
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.imageUrl} alt={label} style={{ filter }} />
        )}

        {status === "done" && result?.placeholder && !isNow && (
          <div
            className="mock-aging-overlay"
            style={agingOverlayStyle}
            aria-hidden="true"
          />
        )}

        {status === "pending" && (
          <div className="slice-pending" aria-label="生成中">
            <span />
            <p>切片生成中</p>
          </div>
        )}

        {status === "error" && (
          <div className="slice-error">
            <p>{error || "时间切片失败"}</p>
            {onRetry && (
              <button onClick={onRetry} className="inline-command">
                重试
              </button>
            )}
          </div>
        )}

        {status === "done" && <div className="slice-shine" aria-hidden="true" />}
      </div>

      <figcaption className="slice-footer">
        <span>{statusLabel}</span>
        <i aria-hidden="true" />
      </figcaption>
    </figure>
  );
}

function getStatusLabel(status: CardStatus, isNow: boolean, placeholder?: boolean) {
  if (status === "pending") return "等待输出";
  if (status === "error") return "需要重试";
  if (isNow) return "当前基准";
  return placeholder ? "占位预览" : "AI 输出";
}

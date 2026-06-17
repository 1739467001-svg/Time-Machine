import type { AgeStep } from "@/lib/ages";
import type { AgedImage } from "@/lib/aging";
import ResultCard, { type CardStatus } from "./ResultCard";

/** 单个未来年龄段的加载状态 */
export interface AgeCard {
  step: AgeStep;
  status: CardStatus;
  result?: AgedImage;
}

interface AgeTimelineProps {
  /** 抓拍的原图（「现在」），data URL */
  originalImage: string;
  /** 各未来年龄段的卡片 */
  cards: AgeCard[];
  /** 重试某个失败的年龄段 */
  onRetry: (stepId: string) => void;
}

export default function AgeTimeline({ originalImage, cards, onRetry }: AgeTimelineProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {/* 「现在」卡片：始终就绪 */}
      <ResultCard
        label="现在"
        yearsFromNow={0}
        status="done"
        result={{
          stepId: "now",
          yearsFromNow: 0,
          label: "现在",
          imageUrl: originalImage,
          placeholder: false,
        }}
      />

      {/* 各未来年龄段 */}
      {cards.map((card) => (
        <ResultCard
          key={card.step.id}
          label={card.step.label}
          yearsFromNow={card.step.yearsFromNow}
          status={card.status}
          result={card.result}
          onRetry={() => onRetry(card.step.id)}
        />
      ))}
    </div>
  );
}

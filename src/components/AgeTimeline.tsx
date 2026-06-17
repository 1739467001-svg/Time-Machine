import type { AgedImage } from "@/lib/aging";
import ResultCard from "./ResultCard";

interface AgeTimelineProps {
  /** 抓拍的原图（「现在」），data URL */
  originalImage: string;
  /** 各未来年龄段的结果 */
  results: AgedImage[];
}

export default function AgeTimeline({ originalImage, results }: AgeTimelineProps) {
  // 把「现在」拼到结果前面，统一按年龄排序展示。
  const nowCard: AgedImage = {
    stepId: "now",
    yearsFromNow: 0,
    label: "现在",
    imageUrl: originalImage,
    placeholder: false,
  };
  const cards = [nowCard, ...results].sort((a, b) => a.yearsFromNow - b.yearsFromNow);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <ResultCard key={card.stepId} result={card} />
      ))}
    </div>
  );
}

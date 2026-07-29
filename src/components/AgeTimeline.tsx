import type { CSSProperties } from "react";
import type { AgeStep } from "@/lib/ages";
import type { AgedImage } from "@/lib/aging";
import ResultCard, { type CardStatus } from "./ResultCard";

export interface AgeCard {
  step: AgeStep;
  status: CardStatus;
  result?: AgedImage;
  error?: string;
}

interface AgeTimelineProps {
  originalImage: string;
  cards: AgeCard[];
  onRetry: (stepId: string) => void;
}

interface TimelineItem {
  id: string;
  label: string;
  yearsFromNow: number;
  status: CardStatus;
  result?: AgedImage;
  error?: string;
  onRetry?: () => void;
}

export default function AgeTimeline({ originalImage, cards, onRetry }: AgeTimelineProps) {
  const items: TimelineItem[] = [
    {
      id: "now",
      label: "现在",
      yearsFromNow: 0,
      status: "done",
      result: {
        stepId: "now",
        yearsFromNow: 0,
        label: "现在",
        imageUrl: originalImage,
        placeholder: false,
      },
    },
    ...cards.map((card) => ({
      id: card.step.id,
      label: card.step.label,
      yearsFromNow: card.step.yearsFromNow,
      status: card.status,
      result: card.result,
      error: card.error,
      onRetry: () => onRetry(card.step.id),
    })),
  ];

  return (
    <div className="timeline-console">
      <div className="timeline-rail" aria-hidden="true">
        <span />
      </div>

      <div className="timeline-list">
        {items.map((item, index) => (
          <article
            key={item.id}
            className={`timeline-node is-${item.status}`}
            style={{ "--node-index": index } as CSSProperties}
          >
            <div className="node-marker">
              <span>{item.yearsFromNow === 0 ? "NOW" : `+${item.yearsFromNow}`}</span>
            </div>
            <ResultCard
              label={item.label}
              yearsFromNow={item.yearsFromNow}
              status={item.status}
              result={item.result}
              error={item.error}
              onRetry={item.onRetry}
              sequence={index}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

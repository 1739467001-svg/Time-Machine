// 时光机的年龄段配置：从「现在」到未来 60 年，每 10 年一档。
// yearsFromNow 同时作为传给变老模型的「目标年龄偏移」。

export interface AgeStep {
  /** 稳定标识，用作 React key 与结果映射 */
  id: string;
  /** 距今多少年（0 表示现在） */
  yearsFromNow: number;
  /** 展示用的中文标签 */
  label: string;
  /** 时间轴上的副标题 */
  caption: string;
}

export const AGE_STEPS: AgeStep[] = [
  { id: "now", yearsFromNow: 0, label: "现在", caption: "此刻的你" },
  { id: "y10", yearsFromNow: 10, label: "10 年后", caption: "+10 岁" },
  { id: "y20", yearsFromNow: 20, label: "20 年后", caption: "+20 岁" },
  { id: "y30", yearsFromNow: 30, label: "30 年后", caption: "+30 岁" },
  { id: "y40", yearsFromNow: 40, label: "40 年后", caption: "+40 岁" },
  { id: "y50", yearsFromNow: 50, label: "50 年后", caption: "+50 岁" },
  { id: "y60", yearsFromNow: 60, label: "60 年后", caption: "+60 岁" },
];

/** 需要 AI 生成的未来年龄段（排除「现在」） */
export const FUTURE_AGE_STEPS = AGE_STEPS.filter((s) => s.yearsFromNow > 0);

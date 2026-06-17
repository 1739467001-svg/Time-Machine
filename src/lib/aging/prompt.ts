import type { AgeStep } from "@/lib/ages";

/**
 * 为某个年龄段构造「变老」提示词。
 *
 * 这是出图质量的关键之一：必须强调「同一个人 / 保持身份」，再叠加具体的
 * 衰老特征。后续可针对不同年龄段细化（如 +60 强调白发、老年斑、皮肤松弛），
 * 也可以把上一段的输出当参考图喂进去，让 10→60 岁的过渡更连贯。
 */
export function buildAgingPrompt(step: AgeStep): string {
  return [
    `Re-age the person in this photo to look ${step.yearsFromNow} years older than they are now.`,
    "Preserve the same identity, face shape, ethnicity, gender, hairstyle structure and pose.",
    "Add realistic, age-appropriate changes: wrinkles, skin texture, age spots, thinning and graying hair, subtle sagging.",
    "Output a photorealistic head-and-shoulders portrait with natural lighting and a neutral background.",
  ].join(" ");
}

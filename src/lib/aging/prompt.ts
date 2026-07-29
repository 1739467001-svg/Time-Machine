import type { AgeStep } from "@/lib/ages";

/**
 * 为某个年龄段构造「变老」提示词。
 *
 * 这是出图质量的关键之一：必须强调「同一个人 / 保持身份」，再叠加具体的
 * 衰老特征。年龄画像按目标实际年龄选择，避免不同当前年龄的用户在相同
 * 「未来年数」下得到同一套衰老指令。
 * 也可以把上一段的输出当参考图喂进去，让 10→60 岁的过渡更连贯。
 */
export function buildAgingPrompt(
  step: AgeStep,
  sourceYearsFromNow = 0,
  currentAge = 20,
): string {
  const yearsToAdd = Math.max(1, step.yearsFromNow - sourceYearsFromNow);
  const sourceAge = currentAge + sourceYearsFromNow;
  const targetAge = currentAge + step.yearsFromNow;
  const profile = getAgingProfile(targetAge);
  const progression = sourceYearsFromNow
    ? `This image shows the same person at approximately ${sourceAge} years old. Age this exact person a further ${yearsToAdd} years so they appear approximately ${targetAge} years old.`
    : `The person is approximately ${currentAge} years old in the source photo. Edit this exact photo so the same person appears approximately ${targetAge} years old.`;

  return [
    progression,
    "Keep the same person and preserve identity above all: same face shape, bone structure, ethnicity, gender presentation, glasses, hairstyle silhouette, clothing, pose, camera angle, crop, lighting direction and background.",
    profile,
    "Make the aging visible in facial anatomy, not just color grading: evolve skin texture, crow's feet, forehead lines, nasolabial folds, under-eye area, hair pigmentation, facial volume and jawline according to the target age.",
    "Use realistic human aging only. Do not beautify, do not change the outfit, do not change the room, do not change expression dramatically, do not turn the person into someone else. Do not merely apply a filter, alter exposure, or return a near-identical image.",
    "Output a photorealistic portrait image. The age progression should be clearly visible while still unmistakably being the same person.",
  ].join(" ");
}

function getAgingProfile(targetAge: number): string {
  const target = `Target actual age: approximately ${targetAge} years old.`;

  if (targetAge <= 19) {
    return `${target} Depict age-appropriate adolescent maturation only: preserve smooth skin, youthful facial volume and natural hair pigmentation. Do not add wrinkles, gray hair, age spots or adult middle-aged features.`;
  }
  if (targetAge <= 29) {
    return `${target} Depict a young adult: mature the facial proportions naturally while keeping smooth skin, full facial volume and predominantly natural hair pigmentation. Allow only very faint expression lines; no age spots, deep wrinkles or elderly features.`;
  }
  if (targetAge <= 39) {
    return `${target} Depict an adult in their thirties. Add subtle maturity: faint crow's feet, light forehead lines, slightly deeper nasolabial folds and mildly leaner cheeks. Keep hair predominantly dark. No age spots, deep wrinkles or elderly features.`;
  }
  if (targetAge <= 49) {
    return `${target} Depict an adult in their forties. Add visible but moderate eye and forehead lines, light under-eye texture, deeper nasolabial folds and modest cheek-volume reduction. Hair should remain mostly dark with only plausible early gray strands. Do not make the person elderly.`;
  }
  if (targetAge <= 59) {
    return `${target} Depict an adult in their fifties. Add moderate forehead and eye wrinkles, under-eye bags, deeper smile lines, mild cheek and jawline softening, subtle neck aging and a realistic mix of dark and gray hair. Avoid elderly exaggeration.`;
  }
  if (targetAge <= 69) {
    return `${target} Depict an adult in their sixties. Add deeper wrinkles, heavier eyelids, visible but realistic skin laxity, beginning jowls, uneven skin texture, neck aging and substantially gray hair.`;
  }
  if (targetAge <= 79) {
    return `${target} Depict an adult in their seventies. Add pronounced forehead and eye wrinkles, sagging cheeks and jawline, thinner lips, age spots, under-eye bags, neck laxity and mostly gray or white hair.`;
  }
  if (targetAge <= 89) {
    return `${target} Depict an adult in their eighties. Add prominent wrinkles, realistic facial-volume loss, heavier eyelids, softer jawline, age spots, thin white-gray hair and clearly aged skin and neck texture. Preserve identity and avoid caricature.`;
  }
  return `${target} Depict plausible advanced old age. Add extensive but natural wrinkles, pronounced skin and neck laxity, facial-volume loss, age spots, heavier eyelids and sparse white-gray hair. Keep the result photorealistic, dignified and recognizable; avoid caricature or horror effects.`;
}

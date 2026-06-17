import type { AgeStep } from "@/lib/ages";

/** 单次变老请求：一张源人脸 + 一个目标年龄段 */
export interface AgingRequest {
  /** 源图，base64 data URL（image/jpeg 或 image/png） */
  imageDataUrl: string;
  /** 目标年龄段 */
  step: AgeStep;
}

/** 变老结果：某个年龄段对应的图像 */
export interface AgedImage {
  stepId: string;
  yearsFromNow: number;
  label: string;
  /** 结果图，可能是 data URL，也可能是远程 URL */
  imageUrl: string;
  /**
   * 占位标记。mock 引擎不会真正改变像素，而是返回 intensity，
   * 让前端用 CSS 滤镜「模拟」变老的视觉效果。
   * 接入真实模型后该字段为 false。
   */
  placeholder: boolean;
  /** 占位强度 0..1，仅在 placeholder=true 时有意义 */
  intensity?: number;
}

/**
 * 变老引擎的统一接口。
 *
 * 任何实现（mock / nano-banana / SAM / 自托管模型）只要满足这个接口，
 * 就能在不改动前端和 API 层的前提下被替换。这是整个项目「不被某个
 * 模型/厂商绑死」的关键。
 */
export interface AgingProvider {
  /** 引擎名，用于日志与返回标识 */
  readonly name: string;
  /** 把一张源人脸变老到指定年龄段 */
  age(request: AgingRequest): Promise<AgedImage>;
}

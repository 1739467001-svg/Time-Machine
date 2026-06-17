import type { AgedImage, AgingProvider, AgingRequest } from "./types";

/**
 * 占位变老引擎：不调用任何 AI，也不联网。
 *
 * 它原样返回源图，并给出一个随年龄递增的 intensity，由前端用 CSS 滤镜
 * 把它渲染成「逐渐变老」的视觉效果。作用是在没有任何 API Key 的情况下，
 * 先把整个产品流程（抓拍 → 处理 → 时间轴展示）完整跑通。
 *
 * 接入真实模型时，把它换成 GeminiAgingProvider 等即可，前端无需改动。
 */
export class MockAgingProvider implements AgingProvider {
  readonly name = "mock";

  async age({ imageDataUrl, step }: AgingRequest): Promise<AgedImage> {
    // 模拟模型推理耗时，让加载态可见
    await delay(400 + Math.random() * 600);

    // 60 年时 intensity 封顶为 1
    const intensity = Math.min(step.yearsFromNow / 60, 1);

    return {
      stepId: step.id,
      yearsFromNow: step.yearsFromNow,
      label: step.label,
      imageUrl: imageDataUrl,
      placeholder: true,
      intensity,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

# 时光机 · Time Machine

拍一张照片，用 AI 推演 **10 / 20 / 30 / 40 / 50 / 60 年后的自己**，生成一条从「现在」到 60 年后的人生时间轴。

> ⚠️ 这是一个**样貌可视化/娱乐**项目，不是科学预测。AI 生成的是「看起来合理」的衰老样貌，并不能真正预知你未来的长相。

## 当前进度

这是项目的 **Web 骨架**：完整的产品流程已跑通（开启摄像头 → 人脸引导 → 抓拍 → 后端处理 → 时间轴展示），变老引擎目前用**本地占位实现**（`mock`），无需任何 API Key 即可运行。真实出图引擎（nano-banana）已写好参考实现，配好 Key 即可切换。

## 技术栈

- **Next.js 16**（App Router）+ React 19 + TypeScript
- **Tailwind CSS v4**
- 摄像头：浏览器原生 `getUserMedia`；人脸存在检测用实验性 `FaceDetector`（不支持时自动降级）
- 后端：Next.js Route Handler（`/api/age`）

## 本地运行

```bash
pnpm install
pnpm dev
# 打开 http://localhost:3000
```

> 摄像头需要安全上下文：`localhost` 可用；部署到线上需 HTTPS。

## 架构：可插拔的变老引擎

整个项目刻意**不被某个模型/厂商绑死**。变老能力被抽象成统一接口 `AgingProvider`（见 `src/lib/aging/types.ts`）：

```
源人脸 + 目标年龄段  ──►  AgingProvider.age()  ──►  该年龄段的图像
```

通过环境变量 `AGING_PROVIDER` 切换实现，前端和 API 层都无需改动：

| 取值 | 实现 | 说明 |
| --- | --- | --- |
| `mock`（默认） | `MockAgingProvider` | 本地占位，用 CSS 滤镜模拟变老，免 Key、可离线 |
| `gemini` | `GeminiAgingProvider` | nano-banana（Gemini 2.5 Flash Image），出图最像，需 `GEMINI_API_KEY` |

### 接入真实出图（nano-banana）

```bash
cp .env.example .env.local
# 在 .env.local 里设置：
#   AGING_PROVIDER=gemini
#   GEMINI_API_KEY=<你的 key>
pnpm dev
```

`GeminiAgingProvider` 是**参考实现**，请求/响应结构请对照[官方文档](https://ai.google.dev/gemini-api/docs/image-generation)校验。

> 后续要接 SAM / FLUX / 自托管模型，只需在 `src/lib/aging/index.ts` 加一个 case 并实现对应 Provider。

## 目录结构

```
src/
  app/
    page.tsx              # 主流程：开场 → 抓拍 → 处理 → 时间轴
    api/age/route.ts      # 后端：对 6 个年龄段并行调用变老引擎
  components/
    CameraCapture.tsx     # 调摄像头 + 人脸引导 + 抓拍
    AgeTimeline.tsx       # 现在 → +10…+60 时间轴
    ResultCard.tsx        # 单个年龄段卡片
  lib/
    ages.ts               # 年龄段配置
    aging/                # 变老引擎（接口 + 各实现）
```

## 隐私

人脸属于敏感的生物特征数据，本项目默认遵循：

- 图像**只在内存中处理**，请求结束即丢弃，不落盘、不入库；
- 默认 `mock` 引擎完全本地，数据不出设备；
- 切到云端引擎（如 Gemini）时，人脸会上传到对应服务商——届时需在 UI 明确告知并取得用户同意。

## 部署

让它联网调百炼生图，两条路（沙箱有出网白名单，你的部署环境没有）：

- **Vercel（推荐测试用，自带 HTTPS，摄像头开箱即用）**：导入仓库 → 设环境变量 `AGING_PROVIDER=qwen` / `DASHSCOPE_API_KEY` / `DASHSCOPE_REGION` → Deploy。
- **自托管**：服务器上写好 `.env`，`docker compose up -d --build`；摄像头需自配 HTTPS 反代。

完整步骤（含分步降风险、排错）见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

## 文档

- 产品需求文档（PRD）：[`docs/PRD.md`](docs/PRD.md)
- 部署指南：[`docs/DEPLOY.md`](docs/DEPLOY.md)
- 项目上下文提示词（喂给 AI 助手 / 新成员快速上手）：[`docs/PROJECT_PROMPT.md`](docs/PROJECT_PROMPT.md)

## 路线图

- [x] Web 骨架 + 可插拔变老引擎 + 占位流程
- [x] 人脸检测升级为 MediaPipe（加载失败自动降级）
- [x] 骨架屏 + 逐张加载、单段失败可重试
- [x] 结果导出（时间轴长图）/ 分享
- [x] 精简 PRD
- [ ] 技术验证（spike）：用真实照片跑通 nano-banana，确认出图质量
- [ ] 切换云端引擎前的阻断式隐私同意弹窗
- [ ] 年龄段之间的连贯性（用上一段输出做参考图）
- [ ] 架构文档 / 完整演示

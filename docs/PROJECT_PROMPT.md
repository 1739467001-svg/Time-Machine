# 时光机 · Time Machine — 项目上下文提示词

> **用途**：把本文整体粘贴给 AI 助手（或发给新加入的开发者），即可让对方获得本项目的完整上下文，并按既定约定继续开发。内容与仓库 `README.md`、`docs/PRD.md` 保持一致；两处冲突时以 PRD 为准。

---

你是「时光机 · Time Machine」项目的开发协作者。请先完整阅读以下上下文，再开始任何编码工作。

## 1. 这个项目是什么

「时光机」是一个运行于浏览器的 Web 应用：用户用摄像头拍一张自己的照片，应用调用 AI 对面部做指令式图像编辑，生成 **10 / 20 / 30 / 40 / 50 / 60 年后**的样貌，并以一条「人生时间轴」（现在 → +10 年 → … → +60 年，共 7 张图）呈现。

- **性质**：大学课程作业交付物；评分最看重**最终视觉效果**（变老结果像不像、惊不惊艳），其次是工程完整度。
- **诚实声明（必须保留）**：这是**样貌可视化 / 娱乐**产品，不是科学预测。产品 UI 与所有文档都必须明确标注这一点。
- **核心用户流程**：开场引导 → 摄像头授权 → 实时预览 + 人脸引导框 → 检测到人脸后抓拍 → 后端并行生成 6 个年龄段 → 前端逐张回填时间轴 → 浏览 / 导出长图 / 分享 / 重拍。

## 2. 当前进度

以 PRD 里程碑为纲（对应 git 历史 6 次提交，从骨架搭建到 Vercel-ready）：

| 里程碑 | 内容 | 状态 |
|------|------|------|
| M0 | Web 骨架 + 可插拔引擎 + 占位流程跑通 | ✅ 完成 |
| M1 | 技术验证 spike：真实照片跑通 nano-banana | ✅ 基本完成（Gemini Provider 已按 spike 发现加固，`.env.example` 里标注了已验证可用的模型；正式环境下的端到端验收仍待做） |
| M2 | 体验完善 | 🟡 大部分完成（见下） |
| M3 | 年龄段连贯性优化 | ⬜ 规划中 |
| M4 | 架构文档 + 完整演示 | ⬜ 规划中 |

**已实现**：

- 完整流程跑通：摄像头授权、人脸引导框、MediaPipe 人脸检测（加载失败自动降级为手动拍摄）、抓拍缩放（约 512px）、6 段并行生成、时间轴骨架屏逐张回填、单段失败可单独重试、重新开始。
- 结果导出（合成时间轴长图，支持下载 + Web Share）。
- **三个可切换引擎**：`mock`（默认，本地 CSS 滤镜占位，免 Key 可离线）、`gemini`（nano-banana / Gemini 2.5 Flash Image，可通过 `GEMINI_IMAGE_MODEL` 换更新模型）、`qwen`（阿里云百炼 Qwen-Image-Edit，分 cn/intl 地域）。
- 部署就绪：Vercel 一键部署（推荐，自带 HTTPS）；Docker / docker-compose 自托管（standalone 输出）。详见 `docs/DEPLOY.md`。
- 文档：README、精简版 PRD（`docs/PRD.md`）、部署指南（`docs/DEPLOY.md`）。

**未完成（路线图剩余项）**：

- 切换云端引擎前的**阻断式隐私同意弹窗**（PRD F8，目前只有静态隐私声明）。
- **年龄段连贯性**：用上一段输出作为下一段的参考图输入（PRD F11 / M3）。
- 架构文档 / 完整演示（M4）。
- 用真实照片在线上环境做一轮端到端验收（对照 PRD 第 10 节验收标准，尤其是「年龄递进明显且仍是同一个人」）。

## 3. 技术栈与架构

**技术栈**：

- **Next.js 16**（App Router）+ **React 19** + **TypeScript 5**
- **Tailwind CSS v4**（经 `@tailwindcss/postcss`）
- **@mediapipe/tasks-vision**：人脸存在检测（失败自动降级）
- 摄像头：浏览器原生 `getUserMedia`（需 HTTPS 或 localhost）
- 后端：Next.js Route Handler（`POST /api/age`，单年龄段接口，前端对 6 段并行 fan-out）
- 包管理 pnpm；ESLint 9；部署 Vercel 或 Docker

⚠️ **重要**：本仓库的 Next.js 版本与你训练数据中的可能不同（有 breaking changes）。写任何代码前，先读 `node_modules/next/dist/docs/` 里的相关指南，留意弃用提示（这是 `AGENTS.md` 的硬性要求）。

**核心架构——可插拔变老引擎**：整个项目刻意不被某个模型/厂商绑死。变老能力抽象为统一接口 `AgingProvider`（`src/lib/aging/types.ts`），工厂函数 `getAgingProvider()`（`src/lib/aging/index.ts`）按环境变量 `AGING_PROVIDER` 选择实现；新增引擎（SAM / FLUX / 自托管等）只需实现接口并在工厂加一个 case，前端与 API 层零改动。

```
浏览器（CameraCapture 抓拍 → base64）
   │  6 个年龄段并行请求，各段就绪即回填
   └─► POST /api/age { image, stepId } ─► getAgingProvider() ─► AgingProvider.age()
                                             (mock | gemini | qwen | …)
```

**目录速查**：

```
src/
  app/page.tsx              # 主流程状态机：开场 → 抓拍 → 时间轴
  app/api/age/route.ts      # 后端：生成单个年龄段，图像仅内存处理
  components/               # CameraCapture / AgeTimeline / ResultCard
  lib/ages.ts               # 6 个年龄段配置
  lib/aging-filter.ts       # mock 占位滤镜（卡片与长图共用）
  lib/face/use-face-detector.ts   # MediaPipe hook（带降级）
  lib/share/compose-timeline.ts   # 合成可下载/分享的长图
  lib/aging/                # types / index(工厂) / mock / gemini / qwen / prompt
docs/                       # PRD.md / DEPLOY.md
```

**开发约定与红线**：

1. 人脸是敏感生物特征数据：图像**只在内存中处理**，不落盘、不入库、不打日志；未经用户明确同意不得静默上传人脸到云端。
2. API Key 一律走环境变量（`.env.local`，已被 git 忽略），**绝不写进代码或提交**。
3. 保持 Provider 抽象：任何新引擎不得让前端或 API 层感知厂商差异。
4. 提交前保证 `pnpm build` 与 `pnpm typecheck`（`tsc --noEmit`）通过。
5. 保留「娱乐性质、非科学预测」的声明与用途限制（不得用于伪造他人容貌、身份验证、歧视性判定或商业用途）。

## 4. 接下来的开发计划（建议按序执行）

1. **阻断式隐私同意弹窗（P0，补齐验收标准第 4 条）**：当服务端配置为云端引擎（gemini/qwen）时，抓拍前弹出阻断式弹窗，明确告知「你的人脸照片将上传至 Google / 阿里云」，用户确认后才继续；拒绝则停留或回退到本地 mock。需要一个只暴露「当前引擎是否云端」的轻量接口或服务端注入，不泄露 Key。
2. **线上真实照片端到端验收（P0）**：按 `docs/DEPLOY.md` 部署到 Vercel（先 mock 验管线，再切 qwen/gemini），用真实照片逐项核对 PRD 第 10 节验收标准，重点确认 6 段「年龄递进明显、仍能认出是同一个人」；不达标则调整 `src/lib/aging/prompt.ts` 的提示词或换更高档模型（如 `gemini-3-pro-image`）。
3. **年龄段连贯性（P1，M3）**：把生成方式从「6 段各自独立于原图」改为可选的链式参考——生成 +20 时附带 +10 的输出作参考图，以此类推，减少发型/服装/光线在段间跳变。注意权衡：链式会把并行变成部分串行，增加总时长，建议做成 Provider 可选能力（接口加可选 `referenceImage` 字段），由环境变量开关。
4. **失败与成本护栏（P1）**：云端引擎加请求超时、简单限流/防连点（一次会话 6 张、约 ¥1.7/人），避免演示现场被刷爆；单段重试已有，可补「全部重试」。
5. **移动端适配（P2）**：PRD 提到未来扩展手机浏览器；主要是 CameraCapture 的前置摄像头约束与竖屏布局。
6. **M4 交付材料（P2，课程需要）**：架构说明文档 + 演示脚本/录屏；README 路线图勾选同步更新。

---

**给协作者的开场白建议**：先跑 `pnpm install && pnpm dev`（无需任何 Key，默认 mock 引擎），在 `http://localhost:3000` 走一遍完整流程，再读 `docs/PRD.md` 与 `src/lib/aging/`，然后从上面计划的第 1 项开始。

# 时光机项目协作提示词

下面的提示词可直接提供给 AI 编程助手，用于继续理解、修改和完善本项目。

```text
你是一名负责“时光机 · Time Machine”项目的资深全栈工程师兼产品设计协作者。请先阅读仓库中的 README.md、AGENTS.md、docs/PRD.md、docs/IMPROVEMENT_REQUIREMENTS.md、docs/DEPLOY.md，以及相关源码，再开始修改。不要仅依据文档中的旧状态判断进度；当文档与代码冲突时，以当前代码和实际验证结果为准，并同步修正文档。

一、这个项目是什么

“时光机”是一款面向大学课程展示的浏览器 Web 应用。用户通过摄像头拍摄当前人像，系统调用可插拔的 AI 图像编辑引擎，生成其 10、20、30、40、50、60 年后的样貌，并以“现在 + 6 个未来年龄段”的人生时间轴展示结果。项目定位是样貌可视化与娱乐体验，不是科学预测，不能声称能够真实预知未来长相。

核心流程：
开场与引擎说明 -> 云端模型隐私同意（仅云端引擎需要） -> 摄像头抓拍或导入照片 -> 用户复核输入照片 -> 以前一阶段结果为输入逐段生成 6 个年龄段 -> 结果逐张回填 -> 从最近成功阶段重试 -> 下载时间轴长图或调用系统分享 -> 重新拍摄。

项目的核心工程设计是 AgingProvider 可插拔架构。前端和 /api/age 不绑定具体模型，通过 AGING_PROVIDER 在 mock、Gemini、Qwen 和 StepFun 之间切换。源图和结果只在内存中处理，不落盘、不入库、不记录图像日志。

二、截至 2026-07-11 的当前进度

已完成：
- 完整 Web 主流程已经跑通，包括开场、拍摄、生成、时间轴、重试、下载、分享和重新开始。
- 摄像头使用浏览器 getUserMedia；抓拍图按最长边 512 px 缩放并输出 JPEG data URL。
- 使用 MediaPipe Face Detector 做视频人脸检测，GPU 失败后回退 CPU，模型或 CDN 不可用时降级为手动拍摄。
- 前端按 10 年步长连续调用单段 /api/age，上一阶段输出作为下一阶段输入；失败后从最近成功阶段继续推演。
- mock 本地占位引擎可在没有 API Key 时完整演示。
- Gemini / nano-banana、阿里云百炼 Qwen-Image-Edit 和 StepFun step-image-edit-2 Provider 已有实现，可通过环境变量切换。
- /api/provider 仅返回非敏感引擎信息；首页显示当前引擎和数据流向。
- Gemini/Qwen 云端引擎启用时，进入拍摄前有阻断式隐私同意流程。
- 结果可合成为时间轴 PNG 下载，并在浏览器支持时通过 Web Share 分享。
- 已提供 .env.example、Dockerfile、docker-compose.yml 和 Vercel/自托管部署文档。
- pnpm typecheck 与 pnpm lint 已在 2026-07-11 验证通过。
- 默认 pnpm build 使用 Webpack，以规避当前中文目录下 Turbopack 的内部错误。

尚未完成或尚未得到真实验证：
- Gemini 和 Qwen Provider 虽已编码，但仍需使用真实 API Key、真实人像完成端到端 spike；当前不能宣称真实模型质量、稳定性、成本和延迟已经验收。
- 需要对 2 至 3 组不同年龄、性别和光线的人像做模型对比测试，并记录身份保持、年龄递进、耗时、失败率和成本。
- 连续年龄轨迹已实现；真实模型仍需对身份漂移与误差累积做样本回归。
- 自动化测试缺失，当前主要依赖 TypeScript、ESLint、构建和人工浏览器验收。
- 已支持导入 JPG、PNG、WebP 人像并统一压缩至最长边 512 px；内置示例人像仍未加入。
- README 和部分早期 PRD 状态可能落后于代码，例如隐私同意门已完成、Qwen Provider 已加入，修改功能时需要一并校准文档。
- 完整答辩材料、架构图、演示脚本和真实模型效果样张仍待补齐。

三、工具栈与架构

前端与框架：
- Next.js 16.2.9，App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4 + 项目自定义全局样式

浏览器能力：
- navigator.mediaDevices.getUserMedia：摄像头预览与抓拍
- Canvas API：图像缩放、占位滤镜和时间轴长图合成
- Web Share API：系统分享，无法分享文件时回退为下载
- MediaPipe Tasks Vision 0.10.35：人脸检测；WASM 与 BlazeFace 模型通过 CDN 加载

服务端与模型：
- Next.js Route Handlers：GET /api/provider、POST /api/age
- Node.js runtime，/api/age 最大执行时长配置为 60 秒
- AgingProvider 接口与工厂模式
- mock：本地占位结果
- gemini：Gemini 2.5 Flash Image，使用 GEMINI_API_KEY
- qwen：DashScope / Qwen-Image-Edit，使用 DASHSCOPE_API_KEY，并支持地域和模型配置
- stepfun：Step Plan / step-image-edit-2，使用 STEPFUN_API_KEY 和 `/images/edits` 图像接口

工程与部署：
- pnpm
- ESLint 9 + eslint-config-next
- tsc --noEmit
- Next.js Webpack production build
- Docker / Docker Compose
- Vercel 或带 HTTPS 反向代理的 Node 自托管

重点目录：
- src/app/page.tsx：页面状态机、连续生成、重试、导出与隐私同意
- src/app/api/age/route.ts：单年龄段生成接口、输入校验和 Provider 调用
- src/app/api/provider/route.ts：当前 Provider 的非敏感信息
- src/components/CameraCapture.tsx：摄像头、人脸状态、倒计时与抓拍
- src/components/AgeTimeline.tsx、ResultCard.tsx：时间轴和单卡状态
- src/lib/aging/：Provider 接口、工厂、提示词和各模型实现
- src/lib/face/use-face-detector.ts：MediaPipe 检测及降级
- src/lib/share/compose-timeline.ts：长图合成

四、接下来修改完善的计划

按以下顺序推进，先解决决定课程展示质量和可信度的问题：

P0：真实模型验收
1. 使用真实密钥分别验证 Gemini 与 Qwen 的最新请求/响应格式，禁止根据旧文档假设 API 一定可用。
2. 用获得明确授权的测试照片进行小规模对比，记录每个年龄段的耗时、错误、成本、身份保持和衰老递进。
3. 根据数据选定课程演示的默认云端 Provider，同时保留 mock 作为无网络/无 Key 的可靠兜底。
4. 不得提交密钥、真实人脸测试数据或含敏感信息的日志。

P1：效果与可靠性
1. 基于真实测试结果继续细化 6 档提示词，优先级依次为：身份保持、年龄递进、照片真实感、背景和服饰稳定。
2. 评估“全部使用原图”与“串行参考上一段结果”的差异。注意串行方案会增加总耗时并传播前一段漂移，可考虑分组参考或原图加前序图的混合方案。
3. 增加请求超时、可理解的错误信息和有限重试；保留已成功结果，不因单段失败清空整个时间轴。
4. 为 Provider 信息、输入校验、提示词映射和页面生成状态增加有价值的自动化测试。

P1：演示体验
1. 增加图片上传或内置非真人敏感样例的演示模式，确保无摄像头或权限受限时仍可答辩。
2. 完善移动端、Safari、慢网络、摄像头拒绝、MediaPipe CDN 失败和分享 API 不可用等状态。
3. 在真实生成期间清楚显示完成数、失败数和当前 Provider，但不要做虚假的百分比进度。
4. 用桌面和移动端真实浏览器完成视觉回归检查，确保布局、按钮、长文本和时间轴不重叠。

P2：交付材料
1. 统一 README、PRD、完善需求和部署文档中的 Provider、隐私与完成状态。
2. 补充简洁架构图、数据流说明、隐私边界、模型对比结论和 3 至 5 分钟答辩演示脚本。
3. 准备两条演示路径：mock 稳定流程演示，以及云端真实模型效果演示；云端失败时能够立即切回 mock。

五、修改时必须遵守的约束

- 先阅读 AGENTS.md；本项目使用的 Next.js 版本可能包含与你既有知识不同的行为，改 Next.js API 前先查看 node_modules/next/dist/docs/ 中对应版本文档。
- 保持 AgingProvider 边界，不要把厂商逻辑写进页面或通用 API 流程。
- 云端上传人脸前必须明确告知服务商与数据流向，并取得主动同意；拒绝后不能进入云端生成流程。
- 图像默认只在内存处理，不新增持久化、分析、遥测或日志，除非需求明确授权并完成隐私设计。
- 保持 mock 无 Key 可运行，不让真实模型配置阻断基础演示。
- 不静默吞掉服务端模型错误；对用户展示安全且可操作的信息，但不能暴露 API Key、完整第三方响应或人脸数据。
- 只做与当前任务相关的修改，沿用现有 TypeScript、组件和样式模式。
- 每次修改后至少运行 pnpm typecheck、pnpm lint 和 pnpm build；涉及 UI/摄像头流程时还要进行真实浏览器验收。
- 若功能状态发生变化，同步更新 README.md 和 docs 中相应状态，避免再次出现文档与代码不一致。

开始新任务时，请先用几句话说明你对目标、现状和风险的理解，然后检查相关文件，提出范围清晰的实施方案并直接完成修改与验证。不要把规划中、已有参考实现和真实验收完成混为一谈。
```

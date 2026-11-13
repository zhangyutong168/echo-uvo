# 架构决策记录

## ADR-1: Embedding 放浏览器（transformers.js）而非服务器

**决策**：语义向量在用户浏览器的 Web Worker 里算，模型 118MB 首次下载后缓存。

**理由**：
- 隐私即卖点：反馈文本不出设备，客服记录/内部 vocal 数据也能放心用
- 零推理成本：Vercel 免费版可跑，无 GPU、无限流、无账单
- 演示即产品：面试官/试用者打开就能跑全流程，不需要后端依赖

**代价**：首次加载 118MB（进度条 + 缓存化解）；2000+ 条约 30–60 秒；低端机 wasm 推理慢。

## ADR-2: 模型与 wasm 同源自托管，不走公共 CDN

**决策**：`public/models/` 与 `public/wasm/` 由构建脚本填充（fetch-model.mjs / copy-wasm.mjs），gitignore 不入库。

**理由**：
- transformers.js 默认从 cdn.jsdelivr.net 拉 ORT wasm，从 huggingface.co 拉模型——前者在国内网络间歇 TLS 失败（worker 静默卡死），后者直接不可达
- 同源 = 零第三方请求 = 隐私承诺完整
- 118MB 超 GitHub 单文件限制，所以"构建时下载"而非入库；下载链 huggingface.co → hf-mirror.com → modelscope.cn 保证国内外 CI 都能过

## ADR-3: Worker 用 esbuild 独立打包，不用 Turbopack 的 new Worker(url) 链

**决策**：`scripts/build-worker.mjs` 把 `lib/workers/embed.worker.ts` 打成自包含 `public/embed.worker.js`，主线程 `new Worker("/embed.worker.js")`。

**理由**：Next 16 Turbopack 的 classic-worker 引导（bootstrap → importScripts 运行时 chunk 链）在模块初始化抛错时**静默吞异常且不注册 message 监听器**——UI 永远"分析中"、控制台零输出、onerror 不触发。独立打包后失败必触发 onerror，且 dev/prod 行为一致。

**经验**：worker 里的 fetch 相对路径在 blob/classic 两种场景下 base 不同，统一用 `self.location.origin` 拼绝对 URL；ORT wasm 显式 `numThreads=1`，避免在 worker 内再嵌套 ort worker。

## ADR-4: 规则引擎做分诊，LLM 只做命名和叙述

**决策**：四档动作和优先级分是纯规则（可解释、可测试、可 CI）；LLM 负责"把簇名起得像人话"和"把周报写得能读"。

**理由**：
- 分诊是产品核心判断，必须是确定性的——面试官问"为什么这条是该修"，答案是一行公式而不是"模型觉得"
- 规则可以在评测里回归（好评召回/误标），LLM 输出做不到这个稳定性
- BYOK 架构下不能假设 key 存在，核心流程必须无 LLM 完整可用

## ADR-5: 评测跟 CI 而不是"写进 README 的 dead number"

**决策**：`npm run eval` 在 CI 里跑，卡阈值（ARI≥0.3 / purity≥0.5 / silhouette≥0.05 / 好评召回≥0.6 / 误标≤2）。

**理由**：AI 产品的输出质量验证必须可重复。评测还真的抓过 bug：4星功能建议被判入"好评"桶——规则改成"纯好评占比"后回归通过。README 里的数字每次 CI 都会重新验证。

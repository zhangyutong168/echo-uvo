# Echo · 用户之声智能归因台

**把几百条散落的用户反馈，3 分钟变成一份带行动建议的用户之声周报。**

Echo 是一个面向用户运营 / AI 产品经理的工作台：上传应用商店评论、客服记录或任何反馈 CSV，它在**你的浏览器里**完成语义聚类、情绪×影响面打分和行动分诊——用户数据不出设备，无需注册、无需 API key 即可跑通全流程。

[在线 Demo](https://echo-uvo.vercel.app) · [快速开始](#快速开始) · [方法论文档](docs/) · [聚类评测](#评测)

---

## 为什么做这个

用户运营每天面对的真实困境：

- **反馈散落**：应用商店、客服工单、社群、问卷……几百条文本，人工读不完
- **归因困难**：知道"很多人在抱怨"，但说不清**哪件事**最值得这周修
- **行动断层**：分析完只有一堆图表，没有"该修什么、该回谁、该忽略什么"

BI 工具解决的是指标监控，不是**文本归因**。LLM 逐条总结能做归因，但几百条要花钱、要传数据、要等。Echo 的答案：**本地 embedding 聚类做归因 + 规则引擎做分诊**，LLM 只是可选的增强层（BYOK）。

## 它做什么

```
CSV / 演示数据 → 清洗去重 → 语义聚类(自动定k) → 情绪×影响面×趋势打分
     → 四档分诊 → Dashboard(气泡图/趋势/下钻) → 用户之声周报(Markdown/打印)
```

**分诊四档**（这是产品的核心方法论）：

| 档位 | 判定规则 | 动作 |
|------|---------|------|
| 🔴 该修 | 声量占比 ≥8% 且负面率 ≥50% | 本周排期修复 |
| 🟡 该回 | 负面率 ≥30% 但声量小 | 逐条触达，优先低评分用户 |
| 🔵 观察 | 有声量但情绪中性/混合 | 持续跟踪动量 |
| 🟢 好评 | 纯好评占多数 | 截取原声用于商店回复与传播 |

优先级分 = 影响面(35) + 负面率(35) + 动量(15) + 评分(10)，动量 = 簇在近 30 天反馈中的占比相对历史占比的变化——**"该修"档自动浮出正在恶化的问题**。

## 关键设计

### 1. 隐私优先：全流程在浏览器内完成

Embedding 用 [transformers.js](https://github.com/xenova/transformers.js) 加载多语言 MiniLM（int8 量化，118MB，首次加载后浏览器缓存），KMeans/TF-IDF/分诊全部运行在 Web Worker。**没有任何反馈文本离开你的设备**——这既是隐私承诺，也让部署成本为零（Vercel 免费版即可跑）。

- 模型文件与 ONNX Runtime wasm 全部同源自托管（`public/models/`、`public/wasm/`），构建时自动下载（见 `scripts/fetch-model.mjs`）
- 60 秒下载无进展自动报错重试，不会无限转圈

### 2. LLM 是增强，不是依赖

`lib/llm/provider.ts` 统一 OpenAI-compatible 接口（智谱 GLM / DeepSeek / Moonshot / OpenAI 预设）。**无 key 时自动降级**：TF-IDF 关键词做主题命名 + 规则模板生成周报。任何人打开 demo 都能看到完整流程；配置 key 后获得更自然的主题命名与报告叙述。Key 存 localStorage（BYOK），不经服务器。

### 3. 评测驱动（AI 时代产品的基本功）

`eval/cluster-eval.ts` 在 Node 端跑与浏览器完全相同的流水线，对 57 条带人工主题标签的样例数据计算聚类质量与分诊合理性，CI 卡阈值：

```
自动定 k=4:  ARI 0.302 | Purity 0.526 | Silhouette 0.130
对照  k=8:  ARI 0.170 | Purity 0.526 | Silhouette 0.102
分诊 好评召回: 8/9 · 非好评簇误标: 0
✅ PASS
```

这个结果值得展开讲（也是我们想展示的产品判断）：

- **自动定 k 选了 4 而真实标签有 8 个主题——但强制 k=8 的 ARI 反而更差（0.170 < 0.302）**。原因：登录/计费/客服这类语义相近的负面主题在嵌入空间本就相邻，强制细分会碎片化。对"归因台"这个场景，把"账号与服务问题"合成一个主题恰恰是运营想要的粒度，所以产品保留肘部法自动定 k。
- 评测还抓到过一个真实分诊缺陷：4 星功能建议按评分会被判为"好评"，但它们是路线图输入、不是可传播的原声——`decideAction` 因此改为统计**纯好评**（好评且非建议句式）占比。这类"评测发现→规则修正→回归通过"的循环正是我们在 AI 产品里验证输出质量的方式。

## 架构

```
app/                    Next.js 16 App Router（landing / analyze / dashboard / report / case-study / settings）
  └─ api/               LLM 代理（BYOK 透传）+ health
lib/
  ├─ ingest/            CSV 解析(papaparse) + 列映射 + 57 条双语仿真演示数据
  ├─ pipeline/          clean → embed → cluster(kmeans++/自动k/轮廓系数) → text(TF-IDF) → score(分诊引擎)
  ├─ llm/               provider 抽象 + no-key 降级模板
  ├─ store/             IndexedDB（分析结果本地留存，可回看历史）
  └─ workers/           embed.worker.ts（transformers.js + 全流水线，独立 esbuild 打包）
components/             气泡图 / 趋势 / 簇下钻 / 周报 / 上传向导
eval/cluster-eval.ts    聚类质量 + 分诊合理性评测（CI 集成）
data/samples/           可下载的示例 CSV
```

**一处在意的工程细节**：Next.js 16 Turbopack 的 classic-worker 引导链（`turbopack-worker-*.js#params=…` → importScripts 运行时 chunk）在模块初始化失败时会**静默吞掉异常且不注册消息监听器**，UI 永远停在"分析中"且控制台无任何输出。我们改为 `scripts/build-worker.mjs` 用 esbuild 把 worker 打成自包含的 `public/embed.worker.js`（node 内置模块 stub 化），dev/prod 行为完全一致，且失败会正常触发 `onerror`。细节见脚本注释。

## 快速开始

```bash
git clone https://github.com/<you>/echo-uvo.git
cd echo-uvo
npm install        # postinstall 会把 ORT wasm 复制到 public/wasm/
npm run dev        # predev 打包 worker；首次打开会自动下载模型(118MB)
```

打开 http://localhost:3000 → "开始使用" → **使用内置演示数据** → 开始分析。模型加载完成后约 2 秒出结果（57 条）。

上传自己的数据：准备含 `评论内容`（必填）、`评分`、`日期`、`作者` 列的 CSV，向导会引导列映射。

生产构建：

```bash
npm run build      # prebuild: 打包 worker + 下载模型到 public/models
npm start
```

> 模型与 wasm 体积原因不入库（118MB 超 GitHub 单文件限制），构建时自动从 huggingface.co → hf-mirror.com → modelscope.cn 链式下载，国内网络无需代理。

## 评测

```bash
npm run eval       # 需先 npm run fetch-model
```

指标：ARI（对人工标签，机会校正）、Purity（簇内多数主题占比）、Silhouette（余弦，几何内聚/分离）、分诊好评召回与误标。CI（GitHub Actions）在 ARI<0.3 / purity<0.5 / silhouette<0.05 / 好评召回<0.6 时失败。完整讨论见上文[关键设计](#3-评测驱动ai-时代产品的基本功)。

## 局限与边界（诚实声明）

- 演示数据是**仿真**的（UI 内已标注），用于展示方法与交互；真实数据接入即用同一流水线
- 浏览器端 embedding 对 2000+ 条反馈约 30–60 秒；更大的量建议先抽样或分批
- 中文商店评论短文本（<10 字）语义信号弱，聚类会与去重/过短过滤协同处理
- 轮廓系数在短文本上偏低（0.13）是文本聚类的常态，评测因此同时看 ARI 与分诊合理性而非单一指标

## Roadmap

- [ ] LLM 主题命名的人评（LLM-as-judge + 人工抽检双轨）
- [ ] 周报定时生成（本地计划任务 / Cron）
- [ ] 多数据源连接器（App Store / Google Play 导出直读）

## License

MIT

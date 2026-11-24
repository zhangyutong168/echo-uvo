import Link from "next/link";

const SCENES = ["应用商店评论", "客服工单", "社群反馈", "问卷开放题"];

const FEATURES = [
  {
    icon: "🗂️",
    title: "批量归集",
    desc: "上传 CSV（应用商店评论、客服记录、社群反馈），自动清洗去重，列映射一目了然。",
  },
  {
    icon: "🧠",
    title: "语义聚类",
    desc: "多语言 MiniLM 在你的浏览器内向量化，KMeans 自动定簇数，反馈按「用户在说什么」自动归堆。",
  },
  {
    icon: "🎯",
    title: "归因分诊",
    desc: "影响面 × 负面率 × 动量三因子打分，规则引擎输出四档行动：该修 / 该回 / 观察 / 好评。",
  },
  {
    icon: "📝",
    title: "一键周报",
    desc: "「本周用户之声」自动成稿，按行动分桶，复制 Markdown 或打印成 PDF 直接进周会。",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-24 lg:px-10">
      {/* Hero：WorkBuddy 式居中大标题 + 场景胶囊 + 大圆角输入卡 */}
      <section className="pt-16 pb-14 text-center lg:pt-24">
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.15]">
          Echo，把用户声音
          <br />
          变成行动清单
        </h1>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {SCENES.map((s) => (
            <span
              key={s}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-ink-500"
            >
              {s}
            </span>
          ))}
        </div>

        {/* 大圆角“任务输入卡”：landing 的核心动作区 */}
        <div className="mt-8 rounded-[28px] border border-gray-100 bg-white p-2 shadow-[0_18px_50px_-24px_rgba(16,20,24,0.25)]">
          <div className="rounded-[22px] border border-gray-100 bg-surface/60 px-6 py-7">
            <p className="text-base text-ink-400">
              上传一份反馈 CSV，其余交给 Echo —— 聚类、归因、周报全自动
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/analyze"
                className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                开始分析 · 无需注册
              </Link>
              <Link
                href="/case-study"
                className="rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-surface"
              >
                先看真实案例
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-400">
              全程在你的浏览器内计算 · 反馈数据不上传服务器 · 无 LLM key 也可完整体验
            </p>
          </div>
        </div>
      </section>

      {/* Pipeline：胶囊步骤条 */}
      <section className="pb-16">
        <div className="flex flex-col items-center gap-2.5 text-sm font-medium text-ink-500 md:flex-row md:justify-center md:gap-1.5">
          {["📥 输入 CSV", "🧹 清洗去重", "🧠 语义聚类", "🎯 归因打分", "🚦 四档分诊", "📝 生成周报"].map(
            (step, i) => (
              <div key={step} className="flex items-center gap-1.5">
                {i > 0 && <span className="hidden text-gray-300 md:inline">→</span>}
                <span className="rounded-full border border-gray-100 bg-surface px-4 py-1.5">
                  {step}
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Features */}
      <section>
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink-900">
          一条完整的「反馈 → 行动」闭环
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-gray-100 bg-white p-6 transition hover:shadow-[0_12px_36px_-20px_rgba(16,20,24,0.2)]"
            >
              <p className="text-2xl">{f.icon}</p>
              <h3 className="mt-2.5 text-base font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="mt-14">
        <div className="rounded-[28px] bg-ink-900 p-8 text-white sm:p-10">
          <h2 className="text-xl font-bold tracking-tight">不只是聚类：可解释的分诊规则</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">
            每个主题的优先级分 = 影响面（反馈占比，边际递减）× 35% + 负面率 × 35% + 动量（近 30 天占比变化）× 15% +
            评分偏离 × 10%。规则全部开源在
            <code className="mx-1 rounded-md bg-white/10 px-1.5 py-0.5 text-xs">lib/pipeline/score.ts</code>
            —— 分类结果可解释、可调参、可审计，而不是一个黑盒评分。
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center text-sm md:grid-cols-4">
            <div className="rounded-2xl bg-red-400/15 p-4"><span className="font-semibold text-red-300">该修</span><p className="mt-1 text-xs text-white/50">高声量 × 高负面</p></div>
            <div className="rounded-2xl bg-amber-400/15 p-4"><span className="font-semibold text-amber-300">该回</span><p className="mt-1 text-xs text-white/50">个体诉求逐条触达</p></div>
            <div className="rounded-2xl bg-sky-400/15 p-4"><span className="font-semibold text-sky-300">观察</span><p className="mt-1 text-xs text-white/50">平稳中性保持关注</p></div>
            <div className="rounded-2xl bg-brand-400/20 p-4"><span className="font-semibold text-brand-300">好评</span><p className="mt-1 text-xs text-white/50">放大传播反哺增长</p></div>
          </div>
        </div>
      </section>

      <footer className="mt-16 text-center text-xs text-ink-400">
        Echo · 用户之声智能归因台 — vibecoding portfolio project · 数据在浏览器本地处理
      </footer>
    </div>
  );
}

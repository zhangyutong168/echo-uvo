import Link from "next/link";

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
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold text-indigo-700">Echo · 用户之声</span>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/case-study" className="text-gray-600 hover:text-indigo-600">
            案例
          </Link>
          <Link href="/settings" className="text-gray-600 hover:text-indigo-600">
            设置
          </Link>
          <Link
            href="/analyze"
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            开始分析
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
          Voice of User, Attributed.
        </p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
          把几百条散落的用户反馈
          <br />
          <span className="text-indigo-600">3 分钟变成一份行动清单</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Echo 是面向用户运营与产品经理的用户之声归因台：语义聚类找出「用户到底在说什么」，
          影响面 × 情绪 × 趋势打分决定「先做什么」，一键生成分诊周报。
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/analyze"
            className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
          >
            免费开始 · 无需注册
          </Link>
          <Link
            href="/case-study"
            className="rounded-xl border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50"
          >
            看真实案例
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          全程在你的浏览器内计算 · 反馈数据不上传服务器 · 无 LLM key 也可完整体验
        </p>
      </section>

      {/* Pipeline strip */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-sm font-medium text-gray-500 md:flex-row md:justify-between">
            {["📥 输入 CSV", "🧹 清洗去重", "🧠 语义聚类", "🎯 归因打分", "🚦 四档分诊", "📝 生成周报"].map(
              (step, i) => (
                <div key={step} className="flex items-center gap-3">
                  {i > 0 && <span className="hidden text-gray-300 md:inline">→</span>}
                  <span className="rounded-lg bg-gray-50 px-3 py-1.5">{step}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold">一条完整的「反馈 → 行动」闭环</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-3xl">{f.icon}</p>
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology teaser */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-2xl bg-gray-900 p-10 text-white">
          <h2 className="text-xl font-bold">不只是聚类：可解释的分诊规则</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
            每个主题的优先级分 = 影响面（反馈占比，边际递减）× 35% + 负面率 × 35% + 动量（近 30 天占比变化）× 15% +
            评分偏离 × 10%。规则全部开源在
            <code className="mx-1 rounded bg-gray-800 px-1.5 py-0.5 text-xs">lib/pipeline/score.ts</code>
            —— 分类结果可解释、可调参、可审计，而不是一个黑盒评分。
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center text-sm md:grid-cols-4">
            <div className="rounded-xl bg-red-500/15 p-4"><span className="font-semibold text-red-300">该修</span><p className="mt-1 text-xs text-gray-400">高声量 × 高负面</p></div>
            <div className="rounded-xl bg-amber-500/15 p-4"><span className="font-semibold text-amber-300">该回</span><p className="mt-1 text-xs text-gray-400">个体诉求逐条触达</p></div>
            <div className="rounded-xl bg-sky-500/15 p-4"><span className="font-semibold text-sky-300">观察</span><p className="mt-1 text-xs text-gray-400">平稳中性保持关注</p></div>
            <div className="rounded-xl bg-emerald-500/15 p-4"><span className="font-semibold text-emerald-300">好评</span><p className="mt-1 text-xs text-gray-400">放大传播反哺增长</p></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        Echo · 用户之声智能归因台 — vibecoding portfolio project · 数据在浏览器本地处理
      </footer>
    </main>
  );
}

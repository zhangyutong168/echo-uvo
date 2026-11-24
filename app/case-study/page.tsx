import Link from "next/link";
import type { Metadata } from "next";
import { REAL_CASE } from "@/lib/ingest/real-case";

export const metadata: Metadata = {
  title: "案例研究 · Echo 用户之声",
  description: "用 Echo 分析一批真实产品反馈的完整 walkthrough",
};

const STEPS = [
  {
    n: "01",
    title: "问题：反馈散落在 5 个渠道，周会靠印象吵架",
    body: "运营同学每周从应用商店、客服工单、社群里人工翻 300+ 条反馈，凭印象挑几条放进周报。同一主题的抱怨被反复讨论却从不被量化：到底有多少人在说？在变多还是变少？",
  },
  {
    n: "02",
    title: "输入：一份 CSV，两分钟完成接入",
    body: "把各渠道导出的评论合并为一份 CSV（文本 + 评分 + 日期三列），拖入 Echo。系统自动清洗去重（水军复制粘贴、系统模板回复一次性过滤），列映射自动识别，不确定的可手动调整。",
  },
  {
    n: "03",
    title: "聚类：从 300 条噪声到 7 个主题",
    body: "浏览器内完成语义向量化（数据不出本机），肘部法自动确定簇数。「闪退崩溃」「加载慢」「验证码收不到」「乱扣费」……散落的原始反馈自动归堆成可讨论的主题。",
  },
  {
    n: "04",
    title: "归因：不是所有抱怨都值得修",
    body: "「界面建议」声量不小但情绪中性 → 观察；「验证码收不到」只有 4% 声量但 100% 负面且全部集中在最近一周 → 该修（动量因子把它顶了上来）；「耗电投诉」声量低、散且久远 → 该回。",
  },
  {
    n: "05",
    title: "行动：周报直接进周会",
    body: "一键生成「本周用户之声」：该修 2 项（附影响面与趋势证据）、该回 12 条（附原声链接）、好评 1 组（截图给市场部做素材）。讨论从「我觉得」变成「数据说」。",
  },
];

export default function CaseStudyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← 返回首页
      </Link>
      <p className="mt-8 text-sm font-medium uppercase tracking-widest text-brand-600">
        Case Study
      </p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-ink-900">
        一份产品周报的人力成本：
        <br />
        从 4 小时到 15 分钟
      </h1>
      <p className="mt-4 text-ink-500">
        以下用内置演示数据（仿真，约 100 条评论）走完 Echo 的完整工作流。
        你也可以用自己产品的反馈 CSV 复现全流程。
      </p>

      <ol className="mt-10 space-y-6">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-5">
            <span className="text-2xl font-extrabold text-brand-200">{s.n}</span>
            <div className="flex-1 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
              <h2 className="font-semibold text-ink-900">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Before / after */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
          <h3 className="font-semibold text-red-600">Before · 人工周报</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-red-500">
            <li>⏱ 4 小时/周 人工翻阅</li>
            <li>🎲 主题覆盖凭运气</li>
            <li>🗣 「我觉得用户主要在抱怨…」</li>
            <li>📉 趋势无从判断</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-brand-100 bg-brand-50 p-6">
          <h3 className="font-semibold text-brand-700">After · Echo 周报</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-brand-700">
            <li>⚡ 15 分钟含核对</li>
            <li>🧮 100% 反馈被量化归堆</li>
            <li>📊 「验证码问题 4% 声量、周环比上升」</li>
            <li>🚦 每个主题带行动档位</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/analyze"
          className="inline-block rounded-full bg-brand-500 px-8 py-3.5 font-semibold text-white transition hover:bg-brand-600"
        >
          用演示数据跑一遍 →
        </Link>
      </div>

      {/* Real-data featured case */}
      <div className="mt-20">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-600">
          Featured · 真实数据
        </p>
        <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-ink-900">
          {REAL_CASE.report.headline}
        </h2>
        <p className="mt-4 text-ink-500">
          用 Echo 的完整管线分析 <strong>{REAL_CASE.total} 条真实微软商店评论</strong>
          （Minecraft Launcher 商品页，{REAL_CASE.fetchedAt} 抓取）。以下结果为预计算快照，
          与访客在「新建分析」上传同样的 CSV 得到的结果一致 —— 聚类、打分、分诊全部在本机浏览器完成。
        </p>

        {/* KPI strip */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <MiniKpi label="真实评论" value={`${REAL_CASE.total} 条`} />
          <MiniKpi label="平均星级" value={REAL_CASE.kpis.avgRating.toFixed(2)} />
          <MiniKpi label="语义聚类" value={`${REAL_CASE.k} 个主题`} />
          <MiniKpi
            label="轮廓系数"
            value={REAL_CASE.silhouette.toFixed(2)}
            hint="聚类质量 0-1，越高越独立"
          />
        </div>

        {/* Star vs sentiment paradox callout */}
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="font-semibold text-amber-600">
            ⚠️ 商店评论的特殊陷阱：5 星 ≠ 好评
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-amber-700">
            这批数据 {REAL_CASE.stats.highPct}% 的评论打了 4-5 星，但不少是
            「给游戏打分，不是给启动器打分」，甚至是反讽：「启动器不错，能启动游戏就更不错了」。
            Echo 的分诊不只看星级——按文本语义聚出的「安装报错」「更新失败」主题虽然星高，
            负面内容占比仍被正确识别（26% / 25%），进入「该回」队列。这正是规则引擎
            （影响面 × 负面率 × 动量）存在的意义。
          </p>
        </div>

        {/* Cluster cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {REAL_CASE.clusters.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-semibold text-ink-900">{c.title}</h3>
                <ActionChip action={c.action} />
              </div>
              <p className="mt-1 text-xs text-ink-400">
                {c.count} 条 · 占比 {Math.round(c.share * 100)}% · 负面 {Math.round(c.negativity * 100)}%
                · 平均 {c.avgRating ? c.avgRating.toFixed(1) : "—"} 星
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.keywords.slice(0, 5).map((k) => (
                  <span key={k} className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink-500">
                    {k}
                  </span>
                ))}
              </div>
              {c.quotes[0] && (
                <blockquote className="mt-3 rounded-2xl bg-surface p-3 text-sm leading-relaxed text-ink-600">
                  “{c.quotes[0].t}”
                  <span className="mt-1 block text-xs text-ink-400">
                    {c.quotes[0].a} · {c.quotes[0].r} 星
                  </span>
                </blockquote>
              )}
            </div>
          ))}
        </div>

        {/* Weekly report preview */}
        <div className="mt-10 rounded-[28px] border border-gray-100 bg-white p-8 shadow-[0_10px_40px_-24px_rgba(16,20,24,0.25)]">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-600">
            自动生成的周报 · 节选
          </p>
          <h3 className="mt-2 text-xl font-bold text-ink-900">{REAL_CASE.report.headline}</h3>
          <ReportBlock title="🔴 该修" items={REAL_CASE.report.toFix} />
          <ReportBlock title="🟡 该回" items={REAL_CASE.report.toReply} />
          <ReportBlock title="🟢 好评 · 放大传播" items={REAL_CASE.report.praises} />
        </div>

        {/* Method note */}
        <p className="mt-6 text-xs leading-relaxed text-ink-400">
          数据来源：Microsoft Store 网页版商品页公开评价（商品 ID {REAL_CASE.productId}，{REAL_CASE.fetchedAt} 抓取）。
          管线：多语言 MiniLM 向量化 → 肘部法自动定 k={REAL_CASE.k} → KMeans → 影响面×负面率×动量分诊。
          复现：下载 <code className="rounded bg-surface px-1.5 py-0.5">data/samples/minecraft-launcher-reviews.csv</code>
          上传到「新建分析」即可得到同样的结果。
        </p>
      </div>
    </main>
  );
}

const ACTION_CHIP: Record<string, { label: string; cls: string }> = {
  fix: { label: "该修", cls: "bg-red-50 text-red-600 border-red-200" },
  reply: { label: "该回", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  monitor: { label: "观察", cls: "bg-sky-50 text-sky-600 border-sky-200" },
  praise: { label: "好评", cls: "bg-brand-50 text-brand-700 border-brand-200" },
};

function ActionChip({ action }: { action: string }) {
  const meta = ACTION_CHIP[action] ?? ACTION_CHIP.monitor;
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function MiniKpi(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
      <p className="text-xs text-ink-400">{props.label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{props.value}</p>
      {props.hint && <p className="mt-1 text-xs text-ink-400">{props.hint}</p>}
    </div>
  );
}

function ReportBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-5">
      <h4 className="text-base font-semibold text-ink-900">{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="rounded-2xl bg-surface p-3.5 text-sm leading-relaxed text-ink-600">
            {renderBold(item)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Minimal **bold** renderer for report strings. */
function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

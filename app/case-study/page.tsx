import Link from "next/link";
import type { Metadata } from "next";

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← 返回首页
      </Link>
      <p className="mt-8 text-sm font-medium uppercase tracking-widest text-indigo-500">
        Case Study
      </p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight">
        一份产品周报的人力成本：
        <br />
        从 4 小时到 15 分钟
      </h1>
      <p className="mt-4 text-gray-600">
        以下用内置演示数据（仿真，约 100 条评论）走完 Echo 的完整工作流。
        你也可以用自己产品的反馈 CSV 复现全流程。
      </p>

      <ol className="mt-10 space-y-8">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-5">
            <span className="text-2xl font-extrabold text-indigo-200">{s.n}</span>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Before / after */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h3 className="font-semibold text-red-700">Before · 人工周报</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-red-600">
            <li>⏱ 4 小时/周 人工翻阅</li>
            <li>🎲 主题覆盖凭运气</li>
            <li>🗣 「我觉得用户主要在抱怨…」</li>
            <li>📉 趋势无从判断</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="font-semibold text-emerald-700">After · Echo 周报</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-emerald-700">
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
          className="rounded-xl bg-indigo-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
        >
          用演示数据跑一遍 →
        </Link>
      </div>
    </main>
  );
}

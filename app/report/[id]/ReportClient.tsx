"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnalysisResult, WeeklyReport } from "@/lib/types";
import { getRun } from "@/lib/store/idb";

/**
 * Weekly report view: action-bucketed "本周用户之声" with Markdown copy
 * and print/PDF export (via browser print stylesheet).
 */
export default function ReportClient({ runId }: { runId: number }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getRun(runId).then((r) => (r ? setResult(r) : setNotFound(true)));
  }, [runId]);

  const markdown = useMemo(() => {
    if (!result?.report) return "";
    return reportToMarkdown(result);
  }, [result]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-lg text-ink-500">没有找到这次分析记录。</p>
        <Link href="/analyze" className="mt-4 inline-block rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white">
          重新分析 →
        </Link>
      </div>
    );
  }
  if (!result || !result.report) {
    return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-ink-400">加载中…</div>;
  }

  const r: WeeklyReport = result.report;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 lg:px-10">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/dashboard/${result.createdAt}`} className="text-sm text-brand-600 hover:underline">
          ← 返回 Dashboard
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(markdown).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface"
          >
            {copied ? "已复制 ✓" : "复制 Markdown"}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            打印 / 导出 PDF
          </button>
        </div>
      </div>

      <article className="mt-8 rounded-[28px] border border-gray-100 bg-white p-8 shadow-[0_10px_40px_-24px_rgba(16,20,24,0.25)] print:border-0 print:shadow-none">
        <header className="border-b border-gray-100 pb-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-600">
            用户之声周报 · {new Date(result.createdAt).toLocaleDateString("zh-CN")}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight text-ink-900">{r.headline}</h1>
          <p className="mt-2 text-sm text-ink-400">
            数据源：{result.sourceName} · {result.kpis.total} 条反馈 · 负面占比{" "}
            {Math.round(result.kpis.negativity * 100)}%
            {result.kpis.avgRating ? ` · 平均评分 ${result.kpis.avgRating.toFixed(2)}` : ""} ·
            生成方式：{r.mode === "llm" ? "LLM 归纳" : "关键词模板"}
          </p>
        </header>

        <ReportSection
          tone="fix"
          title="🔴 该修 · 本周排期"
          items={r.toFix}
          empty="本周无需紧急修复的主题。"
        />
        <ReportSection
          tone="reply"
          title="🟡 该回 · 逐条触达"
          items={r.toReply}
          empty="没有需要单独回复的诉求。"
        />
        <ReportSection
          tone="monitor"
          title="🔵 观察 · 持续跟踪"
          items={r.toMonitor}
          empty="暂无需要特别观察的主题。"
        />
        <ReportSection
          tone="praise"
          title="🟢 好评 · 放大传播"
          items={r.praises}
          empty="暂无集中好评。"
        />

        <footer className="mt-8 border-t border-gray-100 pt-4 text-xs text-ink-400">
          由 Echo · 用户之声智能归因台生成 · 打分规则：影响面 × 负面率 × 动量 → 该修 / 该回 / 观察 / 好评
        </footer>
      </article>
    </div>
  );
}

function ReportSection(props: {
  title: string;
  items: string[];
  empty: string;
  tone: "fix" | "reply" | "monitor" | "praise";
}) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-ink-900">{props.title}</h2>
      {props.items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">{props.empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {props.items.map((item, i) => (
            <li
              key={i}
              className="rounded-2xl bg-surface p-3.5 text-sm leading-relaxed text-ink-600"
            >
              {renderBold(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Minimal **bold** renderer for template/LLM strings. */
function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

function reportToMarkdown(result: AnalysisResult): string {
  const r = result.report!;
  const lines: string[] = [
    `# 用户之声周报 · ${new Date(result.createdAt).toLocaleDateString("zh-CN")}`,
    "",
    `> ${r.headline}`,
    "",
    `- 数据源：${result.sourceName}`,
    `- 反馈总量：${result.kpis.total}`,
    `- 负面占比：${Math.round(result.kpis.negativity * 100)}%`,
    result.kpis.avgRating ? `- 平均评分：${result.kpis.avgRating.toFixed(2)}` : "",
    "",
  ];
  const section = (title: string, items: string[]) => {
    lines.push(`## ${title}`, "");
    if (items.length === 0) lines.push("（无）", "");
    for (const i of items) lines.push(`- ${i}`);
    lines.push("");
  };
  section("该修 · 本周排期", r.toFix);
  section("该回 · 逐条触达", r.toReply);
  section("观察 · 持续跟踪", r.toMonitor);
  section("好评 · 放大传播", r.praises);
  lines.push("---", "", "*由 Echo · 用户之声智能归因台生成*");
  return lines.filter(Boolean).join("\n");
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import type { AnalysisResult, Cluster, TriageAction } from "@/lib/types";
import { getRun, membersOf } from "@/lib/store/idb";

const ACTION_META: Record<TriageAction, { label: string; cls: string; desc: string }> = {
  fix: { label: "该修", cls: "bg-red-50 text-red-600 border-red-200", desc: "高声量 × 高负面，建议排期修复" },
  reply: { label: "该回", cls: "bg-amber-50 text-amber-600 border-amber-200", desc: "个体诉求为主，建议逐条回复安抚" },
  monitor: { label: "观察", cls: "bg-sky-50 text-sky-600 border-sky-200", desc: "声量平稳或情绪中性，保持关注" },
  praise: { label: "好评", cls: "bg-brand-50 text-brand-700 border-brand-200", desc: "正面反馈，可用于传播与商店回复" },
};

const COLORS = ["#28b894", "#e4574f", "#f0a03c", "#3d9bd6", "#8b74e8", "#e06fae", "#14a08c", "#f97316", "#64748b", "#a3ce3d", "#0ea5b7", "#c26a4a"];

export default function DashboardClient({ runId }: { runId: number }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Cluster | null>(null);

  useEffect(() => {
    getRun(runId).then((r) => {
      if (r) {
        setResult(r);
        setSelected(r.clusters[0] ?? null);
      } else setNotFound(true);
    });
  }, [runId]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-lg text-ink-500">没有找到这次分析记录（可能已被清除）。</p>
        <Link href="/analyze" className="mt-4 inline-block rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white">
          重新分析 →
        </Link>
      </div>
    );
  }
  if (!result) {
    return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-ink-400">加载中…</div>;
  }

  const bubbleData = result.clusters.map((c) => ({
    ...c,
    x: Math.round(c.share * 1000) / 10, // % share
    y: Math.round(c.negativity * 1000) / 10, // % negativity
    z: c.memberIds.length,
    fill: COLORS[c.id % COLORS.length],
  }));

  const trendSeries = result.timeline.map((p) => {
    const row: Record<string, number | string> = { week: p.week.replace(/^\d{4}-/, "") };
    for (const c of result.clusters) {
      row[`c${c.id}`] = p.counts[c.id] ?? 0;
    }
    return row;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            分析结果 · {result.sourceName}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {new Date(result.createdAt).toLocaleString("zh-CN")} · {result.kpis.total} 条反馈 ·{" "}
            {result.clusters.length} 个主题 · 轮廓系数 {(result.silhouette ?? 0).toFixed(2)} ·
            命名：{result.namingMode === "llm" ? "LLM 增强" : "关键词降级"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/report/${result.createdAt}`} className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            查看周报 →
          </Link>
          <Link href="/analyze" className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-ink-600 transition hover:bg-surface">
            新建分析
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="反馈总量" value={String(result.kpis.total)} />
        <Kpi label="负面占比" value={`${Math.round(result.kpis.negativity * 100)}%`} tone={result.kpis.negativity > 0.4 ? "bad" : "neutral"} />
        <Kpi label="平均评分" value={result.kpis.avgRating ? result.kpis.avgRating.toFixed(2) : "—"} />
        <Kpi label="带日期反馈" value={`${result.kpis.dated} 条`} hint={result.kpis.dated === 0 ? "无日期列，趋势不可用" : undefined} />
      </div>

      {/* Bubble chart: impact x negativity */}
      <Panel title="主题分布 · 影响面 × 负面率" hint="气泡大小 = 反馈条数；右上角 = 高影响高负面（优先修复）">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 24, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis
                type="number" dataKey="x" name="影响面" unit="%" domain={[0, "dataMax + 5"]}
                label={{ value: "影响面（反馈占比）", position: "insideBottom", offset: -16, fontSize: 12 }}
                tick={{ fill: "#9aa3b2", fontSize: 12 }}
              />
              <YAxis
                type="number" dataKey="y" name="负面率" unit="%" domain={[-5, 105]}
                label={{ value: "负面率", angle: -90, position: "insideLeft", fontSize: 12 }}
                tick={{ fill: "#9aa3b2", fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="z" range={[60, 900]} />
              <Tooltip
                formatter={(value, name) => [`${value}${name === "影响面" || name === "负面率" ? "%" : " 条"}`, String(name)]}
                labelFormatter={() => ""}
                content={({ payload }) => {
                  const d = payload?.[0]?.payload as (typeof bubbleData)[0] | undefined;
                  if (!d) return null;
                  return (
                    <div className="rounded-2xl border border-gray-100 bg-white p-3 text-xs shadow-lg">
                      <p className="font-semibold" style={{ color: d.fill }}>{d.title ?? `主题 ${d.id}`}</p>
                      <p className="mt-1 text-ink-500">{d.memberIds.length} 条 · 占比 {d.x}% · 负面 {d.y}%</p>
                      <p className="mt-1 text-ink-400">{ACTION_META[d.action].desc}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={bubbleData} name="主题">
                {bubbleData.map((d) => (
                  <circle
                    key={d.id} cx={d.x} cy={d.y} r={Math.sqrt(d.z) * 3.2}
                    fill={d.fill} fillOpacity={0.65} stroke="#fff" strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => setSelected(result.clusters.find((c) => c.id === d.id) ?? null)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Trend */}
      {result.kpis.dated > 0 && trendSeries.length > 1 && (
        <Panel title="主题声量趋势（周）" hint="各主题每周反馈量；突然上升的主题值得警惕">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="week" fontSize={12} tick={{ fill: "#9aa3b2" }} />
                <YAxis fontSize={12} allowDecimals={false} tick={{ fill: "#9aa3b2" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {result.clusters.slice(0, 8).map((c) => (
                  <Line
                    key={c.id} type="monotone" dataKey={`c${c.id}`} name={(c.title ?? `主题 ${c.id}`).slice(0, 14)}
                    stroke={COLORS[c.id % COLORS.length]} strokeWidth={2} dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Cluster list + detail */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Panel title="主题分诊列表" hint="按优先级分排序">
            <ul className="space-y-2">
              {result.clusters.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selected?.id === c.id
                        ? "border-brand-300 bg-brand-50"
                        : "border-gray-100 hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-ink-900">{c.title ?? `主题 ${c.id}`}</span>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ACTION_META[c.action].cls}`}>
                        {ACTION_META[c.action].label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-400">
                      <span>占比 {Math.round(c.share * 100)}%</span>
                      <span>负面 {Math.round(c.negativity * 100)}%</span>
                      <span>优先级 {c.priority}</span>
                      {c.momentum > 0.03 && <span className="font-medium text-red-500">↑ 上升</span>}
                      {c.momentum < -0.03 && <span>↓ 回落</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="lg:col-span-3">
          {selected && (
            <Panel title={selected.title ?? `主题 ${selected.id}`} hint={ACTION_META[selected.action].desc}>
              <p className="text-sm text-ink-600">{selected.summary}</p>
              {selected.actionNote && (
                <p className="mt-2 rounded-2xl bg-brand-50 p-3.5 text-sm text-brand-700">
                  <span className="font-semibold">行动建议：</span>{selected.actionNote}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink-500">{k}</span>
                ))}
              </div>
              <h4 className="mt-4 text-sm font-semibold text-ink-600">代表性原声</h4>
              <ul className="mt-2 space-y-2">
                {membersOf(result, selected).filter((m) => selected.quoteIds.includes(m.id)).map((m) => (
                  <li key={m.id} className="rounded-2xl bg-surface p-3.5 text-sm">
                    <p className="text-ink-900">{m.text}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      {m.author ?? "匿名"} · {m.rating ? `${m.rating} 星` : "未评分"} · {m.date ?? "无日期"}
                    </p>
                  </li>
                ))}
              </ul>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-brand-600">查看全部 {selected.memberIds.length} 条</summary>
                <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {membersOf(result, selected).map((m) => (
                    <li key={m.id} className="rounded-xl border border-gray-100 p-2 text-xs text-ink-500">
                      {m.text} <span className="text-ink-400">— {m.rating ?? "?"} 星</span>
                    </li>
                  ))}
                </ul>
              </details>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi(props: { label: string; value: string; tone?: "bad" | "neutral"; hint?: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
      <p className="text-xs text-ink-400">{props.label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${props.tone === "bad" ? "text-red-500" : "text-ink-900"}`}>
        {props.value}
      </p>
      {props.hint && <p className="mt-1 text-xs text-ink-400">{props.hint}</p>}
    </div>
  );
}

function Panel(props: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold tracking-tight text-ink-900">{props.title}</h2>
        {props.hint && <p className="text-xs text-ink-400">{props.hint}</p>}
      </div>
      <div className="mt-3">{props.children}</div>
    </section>
  );
}

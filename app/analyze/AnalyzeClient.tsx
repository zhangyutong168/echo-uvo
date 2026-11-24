"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, CleanFeedback } from "@/lib/types";
import { mappedRows, guessMapping, parseCsv } from "@/lib/ingest/csv";
import type { ColumnMapping, ParsedCsv } from "@/lib/ingest/csv";
import { sampleDataset, sampleDatasetCount, SAMPLE_NAME } from "@/lib/ingest/sample";
import { saveRun } from "@/lib/store/idb";
import { templateReport, fallbackTitle, fallbackSummary } from "@/lib/llm/fallback";
import { loadByok } from "@/lib/llm/provider";

type Stage = "idle" | "parsing" | "running" | "done" | "error";

interface WorkerProgress {
  type: "progress";
  done: number;
  total: number;
  stage: "model" | "embed" | "cluster" | "score";
  message?: string;
}

const STAGE_LABEL: Record<string, string> = {
  model: "加载语义模型",
  embed: "向量化",
  cluster: "语义聚类",
  score: "打分与分诊",
};

/**
 * Analyze wizard: CSV upload -> column mapping -> in-browser pipeline ->
 * optional LLM enrichment -> save to IndexedDB -> go to dashboard.
 */
export default function AnalyzeClient() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [llmState, setLlmState] = useState<"idle" | "on" | "off" | "failed">("idle");
  const [hasKey, setHasKey] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read localStorage after mount (SSR-safe), then batch state updates.
    queueMicrotask(() => {
      if (!cancelled) setHasKey(loadByok() !== null);
    });
    return () => {
      cancelled = true;
      workerRef.current?.terminate();
    };
  }, []);

  const onFile = useCallback(async (file: File) => {
    setError(null);
    setStage("parsing");
    setFileName(file.name);
    const text = await file.text();
    const p = parseCsv(text);
    if (p.headers.length === 0 || p.rowCount === 0) {
      setError("无法解析该 CSV：未找到表头或数据行");
      setStage("error");
      return;
    }
    setParsed(p);
    setMapping(guessMapping(p));
    setStage("idle");
  }, []);

  const startWorker = useCallback(
    (items: CleanFeedback[], source: string) =>
      new Promise<AnalysisResult>((resolve, reject) => {
        // Same-origin prebundled worker (scripts/build-worker.mjs → public/embed.worker.js).
        // Bypasses Turbopack's classic-worker importScripts bootstrap, whose nested
        // chunk loading is environment-sensitive; a static file behaves identically
        // in dev and prod. The bundler-URL fallback keeps type checking happy.
        const primary = new Worker("/embed.worker.js");
        const worker = primary;
        workerRef.current = worker;
        worker.addEventListener("message", (ev: MessageEvent) => {
          const msg = ev.data;
          if (msg.type === "progress") setProgress(msg);
          else if (msg.type === "done") {
            const res: AnalysisResult = {
              createdAt: Date.now(),
              sourceName: source,
              items,
              clusters: msg.clusters,
              dropped: { duplicates: 0, tooShort: 0, empty: 0 },
              namingMode: "fallback",
              embeddingMs: msg.embeddingMs,
              silhouette: msg.silhouette,
              k: msg.k,
              timeline: msg.timeline,
              kpis: msg.kpis,
            };
            resolve(res);
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        });
        worker.addEventListener("error", (ev) => reject(new Error(ev.message)));
        worker.postMessage({ type: "embed", items });
      }),
    [],
  );

  const runAnalysis = useCallback(async () => {
    if (parsed && (!mapping?.text)) {
      setError("请先选择评论内容列");
      return;
    }
    setStage("running");
    setError(null);
    try {
      let items: CleanFeedback[];
      let source: string;
      let dropped = { duplicates: 0, tooShort: 0, empty: 0 };

      if (parsed && mapping) {
        const m = mappedRows(parsed, mapping);
        items = m.items;
        dropped = m.dropped;
        source = fileName;
      } else {
        items = sampleDataset();
        source = SAMPLE_NAME;
      }

      if (items.length < 10) {
        setError(`有效反馈仅 ${items.length} 条，至少需要 10 条才能聚类`);
        setStage("error");
        return;
      }

      const res = await startWorker(items, source);
      res.dropped = dropped;

      // LLM enrichment (best-effort): fallback titles/summaries first.
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const c of res.clusters) {
        const members = c.memberIds.map((id) => byId.get(id)!).filter(Boolean);
        c.title = fallbackTitle(c, members);
        c.summary = fallbackSummary(c);
      }
      res.report = templateReport(res.clusters, (c) =>
        c.memberIds.map((id) => byId.get(id)!).filter(Boolean),
      );

      // Try LLM enrichment if key exists.
      const byok = loadByok();
      if (byok) {
        try {
          const resp = await fetch("/api/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clusters: res.clusters.map((c) => ({
                id: c.id,
                keywords: c.keywords,
                share: c.share,
                negativity: c.negativity,
                momentum: c.momentum,
                sampleTexts: c.quoteIds.map((id) => byId.get(id)?.text ?? "").slice(0, 3),
              })),
              corpus: {
                total: res.kpis.total,
                negativity: res.kpis.negativity,
                avgRating: res.kpis.avgRating,
                sourceName: res.sourceName,
              },
              byok,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            for (const ec of data.clusters ?? []) {
              const target = res.clusters.find((c) => c.id === ec.id);
              if (target) {
                target.title = ec.title;
                target.summary = ec.summary;
                target.actionNote = ec.actionNote;
              }
            }
            if (data.report) {
              res.report = { ...data.report, mode: "llm" };
            }
            res.namingMode = "llm";
            setLlmState("on");
          } else {
            setLlmState("failed");
          }
        } catch {
          setLlmState("failed");
        }
      } else {
        setLlmState("off");
      }

      await saveRun(res);
      setResult(res);
      setStage("done");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setStage("error");
    }
  }, [parsed, mapping, fileName, startWorker]);

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">新建分析</h1>
      <p className="mt-2 text-sm text-ink-500">
        上传 CSV（应用商店评论导出、客服记录等），全程在你的浏览器内完成计算，数据不会上传。
      </p>

      {/* Step 1: input */}
      <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
        <h2 className="font-semibold text-ink-900">1 · 选择数据</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            上传 CSV 文件
          </label>
          <button
            onClick={() => {
              setParsed(null);
              setMapping(null);
              setFileName(SAMPLE_NAME);
            }}
            className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-surface"
          >
            使用内置演示数据（{sampleDatasetCount()} 条仿真评论）
          </button>
        </div>
        {fileName && (
          <p className="mt-3 text-sm text-ink-500">
            已选择：<span className="font-medium text-ink-900">{fileName}</span>
            {parsed && `（${parsed.rowCount} 行 × ${parsed.headers.length} 列）`}
          </p>
        )}
      </div>

      {/* Step 2: column mapping */}
      {parsed && mapping && (
        <div className="mt-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
          <h2 className="font-semibold text-ink-900">2 · 确认列映射</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MappingSelect
              label="评论内容（必选）"
              headers={parsed.headers}
              value={mapping.text}
              onChange={(v) => setMapping({ ...mapping, text: v })}
            />
            <MappingSelect
              label="评分 1-5（可选）"
              headers={parsed.headers}
              value={mapping.rating ?? ""}
              allowEmpty
              onChange={(v) => setMapping({ ...mapping, rating: v || undefined })}
            />
            <MappingSelect
              label="日期（可选，用于趋势）"
              headers={parsed.headers}
              value={mapping.date ?? ""}
              allowEmpty
              onChange={(v) => setMapping({ ...mapping, date: v || undefined })}
            />
            <MappingSelect
              label="作者（可选）"
              headers={parsed.headers}
              value={mapping.author ?? ""}
              allowEmpty
              onChange={(v) => setMapping({ ...mapping, author: v || undefined })}
            />
          </div>
        </div>
      )}

      {/* Step 3: run */}
      <div className="mt-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
        <h2 className="font-semibold text-ink-900">3 · 运行分析</h2>
        <p className="mt-2 text-sm text-ink-500">
          {hasKey
            ? "检测到 LLM key：将自动生成主题命名、痛点归纳与周报。"
            : "未配置 LLM key：将使用关键词模式（可在设置中配置后重新分析）。"}
        </p>
        <button
          onClick={runAnalysis}
          disabled={stage === "running" || stage === "parsing" || (!parsed && !fileName)}
          className="mt-4 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stage === "running" ? "分析中…" : "开始分析"}
        </button>

        {stage === "running" && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-ink-500">
              <span>
                {STAGE_LABEL[progress.stage]}
                {progress.message ? ` · ${progress.message}` : ""}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {stage === "done" && result && (
          <div className="mt-4 rounded-2xl bg-brand-50 p-4 text-sm text-brand-700">
            <p className="font-medium">分析完成 ✓</p>
            <p className="mt-1">
              {result.kpis.total} 条反馈 → {result.clusters.length} 个主题 ·
              向量化耗时 {result.embeddingMs < 1000 ? "<1s" : `${Math.round(result.embeddingMs / 1000)}s`} ·
              命名模式：{result.namingMode === "llm" ? "LLM" : "关键词降级"}
              {llmState === "failed" && "（LLM 调用失败，已降级为关键词模式）"}
            </p>
            <a
              href={`/dashboard/${result.createdAt}`}
              className="mt-3 inline-block rounded-full bg-brand-500 px-5 py-2 font-medium text-white transition hover:bg-brand-600"
            >
              查看 Dashboard →
            </a>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}

function MappingSelect(props: {
  label: string;
  headers: string[];
  value: string;
  allowEmpty?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink-500">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-ink-900 focus:border-brand-400 focus:outline-none"
      >
        {props.allowEmpty && <option value="">（不使用）</option>}
        {props.headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}

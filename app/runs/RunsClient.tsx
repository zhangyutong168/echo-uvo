"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  listRuns,
  runDisplayName,
  renameRun,
  deleteRun,
  clearRuns,
  storageEstimateMb,
  notifyRunsChanged,
} from "@/lib/store/idb";

type Stage = "loading" | "ready";

interface RunRow {
  createdAt: number;
  sourceName: string;
  displayName?: string;
  clusters?: number;
  kpis: { total: number; negativity: number; avgRating?: number; dated: number };
}

/**
 * 分析记录管理：全部运行列表 + 重命名 / 删除 / 清空 / 导出 JSON。
 * 数据仍在浏览器 IndexedDB，本页只是多了一个管理入口。
 */
export default function RunsClient() {
  const [stage, setStage] = useState<Stage>("loading");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [usageMb, setUsageMb] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await listRuns();
    setRuns(all);
    setUsageMb(await storageEstimateMb());
    setStage("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) refresh().catch(() => setStage("ready"));
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const commitRename = async (createdAt: number) => {
    const name = editName.trim();
    if (name) {
      await renameRun(createdAt, name);
      await refresh();
      notifyRunsChanged();
      flash("已重命名 ✓");
    }
    setEditing(null);
  };

  const remove = async (r: RunRow) => {
    await deleteRun(r.createdAt);
    await refresh();
    notifyRunsChanged();
    flash(`已删除「${runDisplayName(r).slice(0, 20)}」`);
  };

  const clearAll = async () => {
    const n = await clearRuns();
    setConfirmClear(false);
    await refresh();
    notifyRunsChanged();
    flash(`已清空 ${n} 条记录`);
  };

  const exportRun = (r: RunRow) => {
    // 从 IDB 拿全量记录并下载为 JSON 快照。
    import("@/lib/store/idb").then(({ getRun }) =>
      getRun(r.createdAt).then((run) => {
        if (!run) return;
        const blob = new Blob([JSON.stringify(run, null, 1)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `echo-run-${r.createdAt}.json`;
        a.click();
        URL.revokeObjectURL(url);
        flash("已导出 JSON ✓");
      }),
    );
  };

  if (stage === "loading") {
    return <div className="mx-auto max-w-3xl px-6 py-24 text-center text-ink-400">加载中…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">分析记录</h1>
          <p className="mt-2 text-sm text-ink-500">
            共 {runs.length} 条 · 全部存在浏览器本地（IndexedDB），数据不出设备。
            {usageMb !== null && ` 当前占用约 ${usageMb < 1 ? "<1" : Math.round(usageMb)} MB。`}
          </p>
        </div>
        {runs.length > 0 && (
          <div className="flex gap-2">
            {confirmClear ? (
              <>
                <button
                  onClick={clearAll}
                  className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                  确认清空全部
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-ink-500 transition hover:bg-surface"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
              >
                清空全部
              </button>
            )}
          </div>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
          <p className="text-ink-500">还没有分析记录。</p>
          <Link
            href="/analyze"
            className="mt-4 inline-block rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            用演示数据跑一次 →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {runs.map((r) => (
            <li
              key={r.createdAt}
              className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editing === r.createdAt ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(r.createdAt);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-full max-w-sm rounded-2xl border border-gray-200 px-3 py-1.5 text-sm text-ink-900 focus:border-brand-400 focus:outline-none"
                      />
                      <button
                        onClick={() => commitRename(r.createdAt)}
                        className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-full border border-gray-200 px-3.5 py-1.5 text-xs text-ink-500 transition hover:bg-surface"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/dashboard/${r.createdAt}`}
                      className="block truncate font-semibold text-ink-900 transition hover:text-brand-600"
                      title={runDisplayName(r)}
                    >
                      {runDisplayName(r)}
                    </Link>
                  )}
                  <p className="mt-1 text-xs text-ink-400">
                    {new Date(r.createdAt).toLocaleString("zh-CN")} · {r.kpis.total} 条反馈 ·{" "}
                    {r.clusters ?? "?"} 个主题 · 负面 {Math.round(r.kpis.negativity * 100)}%
                    {r.displayName && r.displayName !== r.sourceName && ` · 来源：${r.sourceName}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconBtn
                    label="重命名"
                    onClick={() => {
                      setEditing(r.createdAt);
                      setEditName(runDisplayName(r));
                    }}
                  >
                    <path d="M4 20h4L19 9l-4-4L4 16v4z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.5 5.5l4 4" />
                  </IconBtn>
                  <IconBtn label="导出 JSON" onClick={() => exportRun(r)}>
                    <path d="M12 4v10" strokeLinecap="round" />
                    <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" />
                  </IconBtn>
                  <IconBtn label="删除" danger onClick={() => remove(r)}>
                    <path d="M4 7h16" strokeLinecap="round" />
                    <path d="M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                  </IconBtn>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function IconBtn(props: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
      className={`rounded-xl border border-gray-100 p-2 text-ink-400 transition hover:bg-surface ${
        props.danger ? "hover:text-red-500" : "hover:text-brand-600"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        {props.children}
      </svg>
    </button>
  );
}

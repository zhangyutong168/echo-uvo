"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listRuns, runDisplayName } from "@/lib/store/idb";
/**
 * WorkBuddy 式应用壳：浅灰侧栏（Logo / 新建分析 / 导航 / 最近分析）
 * + 纯白内容画布。移动端退化为顶部条。
 */

const NAV = [
  { href: "/", label: "工作台", icon: MIconHome },
  { href: "/case-study", label: "案例", icon: MIconDoc },
  { href: "/runs", label: "记录", icon: MIconList },
  { href: "/settings", label: "设置", icon: MIconGear },
] as const;

interface RunBrief {
  createdAt: number;
  sourceName: string;
  displayName?: string;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [runs, setRuns] = useState<RunBrief[]>([]);

  const refresh = useCallback(() => {
    listRuns()
      .then((all) => setRuns(all.slice(0, 5)))
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh, pathname]);

  useEffect(() => {
    // /runs 页改名/删除/清空后广播，侧栏即时同步
    window.addEventListener("echo:runs-changed", refresh);
    return () => window.removeEventListener("echo:runs-changed", refresh);
  }, [refresh]);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
            E
          </span>
          <span className="text-[15px] font-bold tracking-tight text-ink-900">Echo 用户之声</span>
        </div>

        <div className="px-3">
          <Link
            href="/analyze"
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <MIconPlus />
            新建分析
          </Link>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm transition ${
                  active
                    ? "bg-white font-semibold text-ink-900 shadow-sm"
                    : "font-medium text-ink-600 hover:bg-white/60"
                }`}
              >
                <item.icon active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 flex min-h-0 flex-1 flex-col px-3">
          <div className="flex items-baseline justify-between px-3.5 pb-2">
            <p className="text-xs font-medium text-ink-400">分析记录</p>
            {runs.length > 0 && (
              <Link href="/runs" className="text-xs text-brand-600 hover:underline">
                管理
              </Link>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3">
            {runs.length === 0 ? (
              <p className="px-3.5 text-xs leading-relaxed text-ink-400">
                还没有分析记录，
                <Link href="/analyze" className="text-brand-600 hover:underline">
                  用演示数据跑一次
                </Link>
                。
              </p>
            ) : (
              runs.map((r) => (
                <Link
                  key={r.createdAt}
                  href={`/dashboard/${r.createdAt}`}
                  className="block truncate rounded-xl px-3.5 py-2 text-sm text-ink-600 transition hover:bg-white/60"
                  title={runDisplayName(r)}
                >
                  {runDisplayName(r)}
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="mx-3 mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-900">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            本地工作区
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
            分析结果存在浏览器 IndexedDB，数据不出设备。
          </p>
        </div>
      </aside>

      {/* Main canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">
              E
            </span>
            <span className="text-sm font-bold text-ink-900">Echo 用户之声</span>
          </Link>
          <Link
            href="/analyze"
            className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white"
          >
            新建分析
          </Link>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/* 18px、1.5 描边的极简线性图标（currentColor） */
function iconCls(active: boolean) {
  return `h-[18px] w-[18px] ${active ? "text-brand-600" : "text-ink-400"}`;
}

function MIconHome({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconCls(active)}>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MIconDoc({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconCls(active)}>
      <path d="M6 3h9l4 4v14H6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

function MIconList({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconCls(active)}>
      <path d="M8 6h12M8 12h12M8 18h12" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MIconGear({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconCls(active)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" strokeLinecap="round" />
    </svg>
  );
}

function MIconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

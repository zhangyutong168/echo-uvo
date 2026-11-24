"use client";

import { useEffect, useState } from "react";
import { PRESETS, loadByok, saveByok, type ProviderConfig } from "@/lib/llm/provider";

export default function SettingsClient() {
  const [preset, setPreset] = useState<string>("zhipu");
  const [config, setConfig] = useState<ProviderConfig>({
    ...PRESETS.zhipu,
    apiKey: "",
  });
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Load stored BYOK config after mount (SSR-safe).
    queueMicrotask(() => {
      if (cancelled) return;
      const existing = loadByok();
      if (existing) {
        setConfig(existing);
        setHasExisting(true);
        for (const [name, presetDef] of Object.entries(PRESETS)) {
          if (presetDef.baseUrl === existing.baseUrl) setPreset(name);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreset = (name: string) => {
    setPreset(name);
    setConfig((c) => ({ ...PRESETS[name], apiKey: c.apiKey }));
  };

  const save = () => {
    saveByok(config.apiKey.trim() ? config : null);
    setSaved(true);
    setHasExisting(config.apiKey.trim() !== "");
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">设置 · LLM 增强配置</h1>
      <p className="mt-2 text-sm text-ink-500">
        Echo 的聚类与打分 <strong>不需要</strong> 任何 API key。配置 key 后额外解锁：LLM 主题命名、痛点归纳与周报润色。
        Key 只保存在你浏览器本地（BYOK），不会发送到 Echo 服务器以外的任何地方。
      </p>

      <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_6px_24px_-16px_rgba(16,20,24,0.18)]">
        <h2 className="font-semibold text-ink-900">提供商预设</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                preset === name
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-ink-500 hover:bg-surface"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <Field
            label="Base URL（OpenAI 兼容）"
            value={config.baseUrl}
            onChange={(v) => setConfig({ ...config, baseUrl: v })}
          />
          <Field
            label="模型 ID"
            value={config.model}
            onChange={(v) => setConfig({ ...config, model: v })}
          />
          <Field
            label="API Key"
            value={config.apiKey}
            type="password"
            placeholder="sk-...（只存本地 localStorage）"
            onChange={(v) => setConfig({ ...config, apiKey: v })}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            {hasExisting ? "更新配置" : "保存配置"}
          </button>
          {hasExisting && (
            <button
              onClick={() => {
                saveByok(null);
                setConfig({ ...PRESETS.zhipu, apiKey: "" });
                setHasExisting(false);
              }}
              className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-ink-500 transition hover:bg-surface"
            >
              清除
            </button>
          )}
          {saved && <span className="text-sm text-brand-600">已保存 ✓</span>}
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-5 text-sm text-ink-500">
        <p className="font-medium text-ink-900">隐私说明</p>
        <p className="mt-1">
          反馈原文的向量化与聚类全部在本机完成；只有在你主动配置了 key 并点击「开始分析」时，
          每个簇的关键词与 3 条代表性原声会发送给你选择的 LLM 服务商用于命名与归纳。
          不配置 key = 数据零出站。
        </p>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink-500">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-gray-200 px-3.5 py-2.5 font-mono text-sm text-ink-900 focus:border-brand-400 focus:outline-none"
      />
    </label>
  );
}

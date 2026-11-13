import { NextResponse } from "next/server";
import { chatComplete, parseJsonLoose, PRESETS } from "@/lib/llm/provider";
import type { CleanFeedback, Cluster, WeeklyReport } from "@/lib/types";

export const maxDuration = 60;

interface EnrichRequest {
  clusters: Array<{
    id: number;
    keywords: string[];
    share: number;
    negativity: number;
    momentum: number;
    quotes: string[];
    sampleTexts: string[];
  }>;
  corpus: { total: number; negativity: number; avgRating?: number; sourceName: string };
  /** User-supplied key (BYOK). Server env var is used when absent. */
  byok?: { baseUrl: string; apiKey: string; model: string };
}

interface EnrichedCluster {
  id: number;
  title: string;
  summary: string;
  actionNote: string;
}

/**
 * POST /api/enrich
 * LLM pass over pre-clustered feedback: titles, summaries, per-cluster action
 * notes and the weekly report. Falls back to 503 with reason when no key.
 */
export async function POST(req: Request) {
  let body: EnrichRequest;
  try {
    body = (await req.json()) as EnrichRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cfg = body.byok?.apiKey
    ? { baseUrl: body.byok.baseUrl, apiKey: body.byok.apiKey, model: body.byok.model }
    : process.env.LLM_API_KEY
      ? {
          baseUrl: process.env.LLM_BASE_URL ?? PRESETS.zhipu.baseUrl,
          apiKey: process.env.LLM_API_KEY,
          model: process.env.LLM_MODEL ?? PRESETS.zhipu.model,
        }
      : null;

  if (!cfg) {
    return NextResponse.json(
      { error: "no_key", message: "未配置 LLM API key，请在设置中填入或使用关键词模式" },
      { status: 503 },
    );
  }

  const system =
    "你是资深的用户研究分析师。用户会给你若干个已经聚类好的用户反馈簇（关键词、占比、负面率、代表性原声）。" +
    "请为每个簇输出中文标题（≤12字，概括主题而非情绪）、一句话摘要（含影响面与趋势解读）、以及一条运营/产品行动建议。" +
    "同时输出整份『本周用户之声』周报。严格按要求返回 JSON。";

  const userPrompt = JSON.stringify({
    source: body.corpus.sourceName,
    total: body.corpus.total,
    overallNegativity: body.corpus.negativity,
    avgRating: body.corpus.avgRating,
    clusters: body.clusters.map((c) => ({
      id: c.id,
      keywords: c.keywords,
      share: `${Math.round(c.share * 100)}%`,
      negativity: `${Math.round(c.negativity * 100)}%`,
      momentum: c.momentum > 0.03 ? "上升" : c.momentum < -0.03 ? "下降" : "平稳",
      representativeQuotes: c.sampleTexts.slice(0, 3),
    })),
  });

  try {
    const raw = await chatComplete(
      cfg,
      [
        { role: "system", content: system },
        {
          role: "user",
          content:
            userPrompt +
            '\n\n返回 JSON 格式：{"clusters":[{"id":number,"title":string,"summary":string,"actionNote":string}],' +
            '"report":{"headline":string,"toFix":string[],"toReply":string[],"toMonitor":string[],"praises":string[]}}',
        },
      ],
      { temperature: 0.3, maxTokens: 3000, jsonMode: true, timeoutMs: 55000 },
    );

    const parsed = parseJsonLoose<{
      clusters: EnrichedCluster[];
      report: {
        headline: string;
        toFix: string[];
        toReply: string[];
        toMonitor: string[];
        praises: string[];
      };
    }>(raw);

    const report: WeeklyReport = {
      mode: "llm",
      headline: parsed.report.headline,
      toFix: parsed.report.toFix ?? [],
      toReply: parsed.report.toReply ?? [],
      toMonitor: parsed.report.toMonitor ?? [],
      praises: parsed.report.praises ?? [],
      createdAt: Date.now(),
    };

    return NextResponse.json({ clusters: parsed.clusters ?? [], report });
  } catch (err) {
    return NextResponse.json(
      { error: "llm_failed", message: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}

// Type-only exports keep unused imports honest for lint.
export type { CleanFeedback, Cluster };

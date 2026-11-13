// Core domain types for the Echo UVO pipeline.

export interface RawFeedback {
  /** Unique row id assigned during ingest. */
  id: string;
  /** Review / feedback body text. */
  text: string;
  /** Star rating 1-5, if the source provides one. */
  rating?: number;
  /** ISO date string (yyyy-mm-dd), if the source provides one. */
  date?: string;
  /** Author / user name, if the source provides one. */
  author?: string;
}

export interface CleanFeedback extends RawFeedback {
  /** Text after trimming, dedup and length filtering. */
  text: string;
}

export type SentimentLabel = "positive" | "neutral" | "negative";

/** A semantic cluster of feedback items. */
export interface Cluster {
  id: number;
  /** Item ids belonging to this cluster. */
  memberIds: string[];
  /** Human-readable title (LLM-generated, or keyword fallback). */
  title?: string;
  /** One-paragraph summary of what users are saying (LLM-generated). */
  summary?: string;
  /** Action suggestion for this cluster (LLM-generated). */
  actionNote?: string;
  /** Representative verbatim quotes (member ids). */
  quoteIds: string[];
  /** Top TF-IDF keywords for this cluster (fallback naming + display). */
  keywords: string[];
  /** Share of all feedback items, 0-1. */
  share: number;
  /** Negative ratio within cluster, 0-1. */
  negativity: number;
  /** Average rating within cluster (if ratings exist). */
  avgRating?: number;
  /** Trend: recent share minus historical share, -1..1. */
  momentum: number;
  /** Weighted priority score 0-100. */
  priority: number;
  /** Triage bucket produced by the rule engine. */
  action: TriageAction;
}

export type TriageAction = "fix" | "reply" | "monitor" | "praise";

/** Aggregated run output stored in IndexedDB and rendered by the dashboard. */
export interface AnalysisResult {
  /** Millisecond epoch of the run. */
  createdAt: number;
  /** Name of the uploaded file or sample set. */
  sourceName: string;
  /** Input rows after cleaning. */
  items: CleanFeedback[];
  clusters: Cluster[];
  /** Count of rows dropped at cleaning, with reasons. */
  dropped: { duplicates: number; tooShort: number; empty: number };
  /** Which naming path was used: "llm" or "fallback". */
  namingMode: "llm" | "fallback";
  /** Wall-clock embedding time in ms (from the worker). */
  embeddingMs: number;
  /** Clustering quality (mean silhouette, -1..1), surfaced in the UI. */
  silhouette?: number;
  /** Number of clusters k chosen by the elbow step. */
  k?: number;
  /** Weekly time series per cluster for the trend chart. */
  timeline: TimelinePoint[];
  /** Whole-corpus KPI block for the dashboard header. */
  kpis: CorpusKpis;
  /** The generated weekly report (LLM or template). */
  report?: WeeklyReport;
}

export interface TimelinePoint {
  /** ISO week label, e.g. "2026-W42". */
  week: string;
  /** Cluster id -> count in that week. */
  counts: Record<number, number>;
  total: number;
}

export interface CorpusKpis {
  total: number;
  negativity: number;
  avgRating?: number;
  /** Median feedback length in chars. */
  medianLength: number;
  /** Number of date-bearing rows, used for trend reliability note. */
  dated: number;
}

export interface WeeklyReport {
  /** "llm" or "template". */
  mode: "llm" | "template";
  headline: string;
  /** Action-bucketed bullet sections. */
  toFix: string[];
  toReply: string[];
  toMonitor: string[];
  praises: string[];
  /** Generated at epoch ms. */
  createdAt: number;
}

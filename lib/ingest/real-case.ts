// Curated real-data case study: Microsoft Store web reviews for Minecraft
// Launcher (product 9PGW18NPBZV5), scraped 2026-11-24 and precomputed with
// the exact in-browser pipeline (scripts/precompute-case-study.mjs).
// Cluster titles are hand-calibrated after reading members: store reviews
// frequently pair 5-star ratings with complaint text (sarcasm / "rating the
// game, not the launcher"), so auto keyword titles alone mislead.
import caseJson from "../../data/case-studies/minecraft-launcher-case.json";

export interface RealCaseQuote {
  t: string;
  r: number;
  a: string;
  d: string;
}

export interface RealCaseCluster {
  id: number;
  title: string;
  autoTitle: string;
  share: number;
  negativity: number;
  avgRating?: number;
  momentum: number;
  action: "fix" | "reply" | "monitor" | "praise";
  priority: number;
  keywords: string[];
  count: number;
  quotes: RealCaseQuote[];
}

export interface RealCase {
  source: string;
  productId: string;
  fetchedAt: string;
  total: number;
  k: number;
  silhouette: number;
  /** Star-rating split used by the page copy. */
  stats: { low: number; high: number; lowPct: number; highPct: number };
  kpis: {
    total: number;
    negativity: number;
    avgRating: number;
    medianLength: number;
    dated: number;
  };
  clusters: RealCaseCluster[];
  timeline: { week: string; counts: Record<string, number>; total: number }[];
  report: {
    mode: string;
    headline: string;
    toFix: string[];
    toReply: string[];
    toMonitor: string[];
    praises: string[];
    createdAt: number;
  };
}

export const REAL_CASE = caseJson as RealCase;

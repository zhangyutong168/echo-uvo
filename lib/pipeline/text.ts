import type { CleanFeedback, TimelinePoint } from "../types";

const CJK_STOPWORDS = new Set([
  "的", "了", "是", "我", "有", "和", "就", "不", "人", "都", "一个", "也", "很", "着",
  "没", "这", "那", "你", "他", "她", "它", "们", "在", "还", "又", "被", "把", "让",
  "但", "而", "与", "及", "或", "等", "对", "会", "能", "要", "可以", "这个", "那个",
  "什么", "怎么", "为什么", "如果", "因为", "所以", "但是", "然后", "现在", "时候",
  "一直", "总是", "就是", "不是", "没有", "自己", "我们", "你们", "他们", " app ", "APP",
]);

const EN_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "at", "for", "with", "about", "as", "by", "from", "up", "down",
  "it", "its", "this", "that", "these", "those", "i", "me", "my", "we", "our", "you",
  "your", "he", "she", "they", "them", "their", "do", "does", "did", "not", "no", "so",
  "very", "just", "can", "will", "would", "should", "have", "has", "had", "there", "here",
  "app", "apps", "please", "ok", "okay", "get", "got", "when", "what", "why", "how",
]);

/** Tokenize mixed CJK / latin text: CJK bigrams + latin words, stopwords removed. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // Latin words
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9'.-]{1,}/g) ?? []) {
    const clean = w.replace(/[.'-]+$/, "");
    if (clean.length >= 2 && !EN_STOPWORDS.has(clean)) tokens.push(clean);
  }
  // CJK runs -> bigrams (cheap surrogate for word segmentation)
  const cjkRuns = text.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const run of cjkRuns) {
    const chars = Array.from(run);
    if (chars.length === 1) {
      if (!CJK_STOPWORDS.has(chars[0])) tokens.push(chars[0]);
      continue;
    }
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars[i] + chars[i + 1];
      if (!CJK_STOPWORDS.has(chars[i]) && !CJK_STOPWORDS.has(chars[i + 1])) {
        tokens.push(bigram);
      }
    }
  }
  return tokens;
}

/**
 * Top discriminative keywords per cluster using a TF-IDF-like scheme where
 * "documents" are clusters: rewards terms frequent inside the cluster but
 * rare across other clusters.
 */
export function clusterKeywords(
  items: CleanFeedback[],
  clusterOf: Map<string, number>,
  k: number,
  topN = 6,
): string[][] {
  // Term counts per cluster and document frequency across clusters.
  const tf: Map<string, number>[] = Array.from({ length: k }, () => new Map());
  const df = new Map<string, number>();

  for (const item of items) {
    const c = clusterOf.get(item.id);
    if (c === undefined) continue;
    const counts = tf[c];
    const seen = new Set<string>();
    for (const tok of tokenize(item.text)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
      seen.add(tok);
    }
    for (const tok of seen) df.set(tok, (df.get(tok) ?? 0) + 1);
  }

  const nClusters = k;
  const out: string[][] = [];
  for (let c = 0; c < nClusters; c++) {
    const scored: Array<[string, number]> = [];
    for (const [tok, freq] of tf[c]) {
      const docFreq = df.get(tok) ?? 1;
      const idf = Math.log(1 + nClusters / docFreq);
      scored.push([tok, freq * idf]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    out.push(scored.slice(0, topN).map(([t]) => t));
  }
  return out;
}

/**
 * Build weekly time series of cluster volumes. Weeks without any feedback
 * between min and max date are zero-filled for honest trend lines.
 */
export function buildTimeline(
  items: CleanFeedback[],
  clusterOf: Map<string, number>,
  k: number,
): TimelinePoint[] {
  const byWeek = new Map<string, Map<number, number>>();
  let minWeek: string | undefined;
  let maxWeek: string | undefined;

  const isoWeek = (isoDate: string): string => {
    const dt = new Date(isoDate + "T00:00:00Z");
    const target = new Date(dt);
    const dayNum = (dt.getUTCDay() + 6) % 7;
    target.setUTCDate(dt.getUTCDate() - dayNum + 3); // nearest Thursday
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const week =
      1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  };

  for (const item of items) {
    if (!item.date) continue;
    const week = isoWeek(item.date);
    const c = clusterOf.get(item.id);
    if (c === undefined) continue;
    if (!byWeek.has(week)) byWeek.set(week, new Map());
    const weekMap = byWeek.get(week)!;
    weekMap.set(c, (weekMap.get(c) ?? 0) + 1);
    if (!minWeek || week < minWeek) minWeek = week;
    if (!maxWeek || week > maxWeek) maxWeek = week;
  }
  if (!minWeek || !maxWeek) return [];

  // Enumerate weeks between min and max (pad with zeros).
  const points: TimelinePoint[] = [];
  let cursor = new Date(minWeek.slice(0, 4) + "-01-04T00:00:00Z");
  const end = new Date(maxWeek.slice(0, 4) + "-01-04T00:00:00Z");
  const labels: string[] = [];
  let guard = 0;
  while (cursor <= end && guard < 300) {
    const w = isoWeek(cursor.toISOString().slice(0, 10));
    labels.push(w);
    cursor = new Date(cursor.getTime() + 7 * 86400000);
    guard++;
  }
  for (const week of labels) {
    const weekMap = byWeek.get(week) ?? new Map<number, number>();
    const counts: Record<number, number> = {};
    let total = 0;
    for (let c = 0; c < k; c++) {
      const n = weekMap.get(c) ?? 0;
      counts[c] = n;
      total += n;
    }
    points.push({ week, counts, total });
  }
  return points;
}

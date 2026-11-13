import Papa from "papaparse";
import { cleanRows, toIsoDate } from "../pipeline/clean";
import type { RawFeedback } from "../types";

export interface ColumnMapping {
  text: string;
  rating?: string;
  date?: string;
  author?: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

/** Parse CSV text into headers + raw rows (no type coercion). */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = result.data.filter((r) => Object.values(r).some((v) => (v ?? "").trim() !== ""));
  return { headers, rows, rowCount: rows.length };
}

/**
 * Guess a sensible default column mapping from headers.
 * Priority: known names (zh/en) > column with longest average text.
 */
export function guessMapping(parsed: ParsedCsv): ColumnMapping {
  const { headers, rows } = parsed;
  const lower = headers.map((h) => h.toLowerCase());
  const find = (candidates: string[]): string | undefined => {
    for (const cand of candidates) {
      const hit = lower.findIndex((h) => h === cand || h.includes(cand));
      if (hit >= 0) return headers[hit];
    }
    return undefined;
  };

  let text: string | undefined = find(["评论", "内容", "反馈", "text", "review", "content", "feedback", "body", "message"]);
  if (!text) {
    // Fallback: column with the longest average content.
    let bestLen = -1;
    for (const h of headers) {
      const avg =
        rows.slice(0, 50).reduce((s, r) => s + (r[h] ?? "").length, 0) /
        Math.max(1, Math.min(50, rows.length));
      if (avg > bestLen) {
        bestLen = avg;
        text = h;
      }
    }
  }

  const rating = find(["评分", "星级", "rating", "score", "stars", "star"]);
  const date = find(["日期", "时间", "date", "at", "time"]);
  const author = find(["作者", "用户", "昵称", "author", "user", "name", "nickname"]);

  return { text: text ?? headers[0] ?? "", rating, date, author };
}

/** Apply mapping -> RawFeedback[] then run cleaning. Returns final items + drop stats. */
export function mappedRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
): ReturnType<typeof cleanRows> {
  const raw: RawFeedback[] = [];
  parsed.rows.forEach((row, i) => {
    const text = (row[mapping.text] ?? "").trim();
    if (!text) return;
    const ratingRaw = mapping.rating ? row[mapping.rating] : undefined;
    const ratingNum = ratingRaw ? Number.parseFloat(ratingRaw) : NaN;
    raw.push({
      id: `r${i}`,
      text,
      rating: Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : undefined,
      date: toIsoDate(mapping.date ? row[mapping.date] : undefined),
      author: mapping.author ? row[mapping.author] || undefined : undefined,
    });
  });
  return cleanRows(raw);
}

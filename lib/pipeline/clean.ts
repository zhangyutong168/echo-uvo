import type { CleanFeedback, RawFeedback } from "../types";

const MIN_LEN = 4;
const MAX_LEN = 2000;

/** Normalize whitespace and strip control characters. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean raw rows: normalize text, drop empties / too-short rows and
 * exact duplicates (by normalized text). Returns cleaned items plus
 * drop counters for transparency in the UI.
 */
export function cleanRows(rows: RawFeedback[]): {
  items: CleanFeedback[];
  dropped: { duplicates: number; tooShort: number; empty: number };
} {
  const dropped = { duplicates: 0, tooShort: 0, empty: 0 };
  const seen = new Set<string>();
  const items: CleanFeedback[] = [];

  for (const row of rows) {
    const text = normalizeText(row.text ?? "");
    if (!text) {
      dropped.empty++;
      continue;
    }
    if (text.length < MIN_LEN || text.length > MAX_LEN) {
      dropped.tooShort++;
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      dropped.duplicates++;
      continue;
    }
    seen.add(key);
    items.push({ ...row, text });
  }
  return { items, dropped };
}

/** Parse a loose date string into ISO yyyy-mm-dd, or undefined. */
export function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  // Already ISO-ish: 2026-01-02 / 2026/01/02
  const m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Ambiguous dd/mm/yyyy or mm/dd/yyyy: try Date parse as last resort.
  const t = Date.parse(v);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")}`;
  }
  return undefined;
}

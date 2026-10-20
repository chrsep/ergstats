/**
 * Compact text for tool results. Every client reads a tool's text (Claude Code
 * and Codex would read structuredContent instead, ChatGPT would read both), so
 * results are text only, and repeated rows are CSV with one header line
 * instead of JSON objects that repeat every key and null.
 */

type Cell = string | number | null | undefined | false;

/** Empty for missing values, quoted when the value has a comma, quote or newline. */
function cell(value: Cell): string {
  if (value === null || value === undefined || value === false) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/\s+/g, " ").replace(/"/g, '""')}"` : s;
}

export function csv(columns: string[], rows: Cell[][]): string {
  return [columns.join(","), ...rows.map((row) => row.map(cell).join(","))].join("\n");
}

/** "1:54.3/500m" → "1:54.3" when a header already gives the unit; BikeErg's "/1k" stays. */
export function shortPace(pace: string | null): string | null {
  return pace?.replace(/\/500m$/, "") ?? null;
}

/** "29:02:43.0" → "29:02:43": totals don't need tenths, so they are dropped. */
export function wholeSeconds(time: string): string {
  return time.replace(/\.\d$/, "");
}

/** Drops missing (and zero) parts and joins the rest. */
export function join(parts: Cell[], sep = ", "): string {
  return parts.filter(Boolean).join(sep);
}

/** Shortens free text, like an athlete's comment, to one line. */
export function clip(text: string | null, max: number): string | null {
  if (!text) return null;
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

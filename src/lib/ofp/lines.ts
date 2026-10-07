/**
 * Rebuilds monospaced text lines from pdf.js text items.
 * SimBrief OFPs are typeset in a fixed-pitch font, so every glyph sits on a
 * character grid; snapping items to that grid restores the original columns.
 */
export interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
}

export interface PageText {
  page: number;
  lines: string[];
}

const FOOTER = /-\s*Not for real world navigation\s*-/i;

export function itemsToLines(items: RawTextItem[]): string[] {
  const body = items.filter((i) => i.str.trim().length > 0);
  if (body.length === 0) return [];

  // Most common font size = body text; its narrowest left edge = column 0.
  const sizeCount = new Map<number, number>();
  for (const i of body) {
    const s = Math.round(i.size * 10) / 10;
    sizeCount.set(s, (sizeCount.get(s) ?? 0) + i.str.length);
  }
  const bodySize = [...sizeCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const bodyItems = body.filter((i) => Math.abs(i.size - bodySize) < 0.2);
  const pitch =
    bodyItems.reduce((s, i) => s + i.width, 0) /
    Math.max(
      1,
      bodyItems.reduce((s, i) => s + i.str.length, 0),
    );
  const left = Math.min(...bodyItems.map((i) => i.x));

  const rows = new Map<number, { col: number; str: string }[]>();
  for (const i of body) {
    const key = Math.round(i.y * 2) / 2;
    const col = Math.max(0, Math.round((i.x - left) / pitch));
    const row = rows.get(key) ?? [];
    row.push({ col, str: i.str });
    rows.set(key, row);
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => {
      let line = "";
      for (const p of parts.sort((a, b) => a.col - b.col)) {
        if (line.length < p.col) line = line.padEnd(p.col, " ");
        line = line.slice(0, p.col) + p.str + line.slice(p.col + p.str.length);
      }
      return line.replace(/\s+$/, "");
    });
}

/** Drops running header ("U2 714/… Page n") and footer lines. */
export function stripChrome(lines: string[]): string[] {
  return lines.filter((l, idx) => {
    if (FOOTER.test(l)) return false;
    if (idx === 0 && /Page\s+\d+\s*$/.test(l)) return false;
    return true;
  });
}

export function isChartPage(lines: string[]): boolean {
  return stripChrome(lines).every((l) => l.trim() === "");
}

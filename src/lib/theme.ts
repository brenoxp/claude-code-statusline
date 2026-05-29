import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { themes, type ThemeName } from "./themes";

// Theme colors as RGB tuples
export type RgbTuple = [number, number, number];

// Mutable palette. Initialized to the "default" theme. Components import this
// binding and read it at render time, so applyTheme() can swap colors in place
// without breaking existing imports (never reassign the binding).
export const theme = {
  green: [70, 195, 115] as RgbTuple,
  yellow: [230, 180, 50] as RgbTuple,
  orange: [240, 130, 60] as RgbTuple,
  red: [210, 60, 60] as RgbTuple,
  model: [200, 120, 70] as RgbTuple,
  label: [150, 165, 190] as RgbTuple,
  slate: [130, 142, 168] as RgbTuple,
  purple: [160, 140, 220] as RgbTuple,
  muted: [205, 210, 218] as RgbTuple,
  prompt: [160, 175, 195] as RgbTuple,
  barDim: [195, 195, 210] as RgbTuple,
  barLerp: [255, 255, 255] as RgbTuple,
};

// Swap the live palette to a named preset, then apply optional per-key RGB
// overrides on top. Mutates `theme` in place so existing imports see new values.
// Unknown theme name falls back to "default". Invalid overrides are skipped.
export function applyTheme(
  name: ThemeName | string,
  overrides?: Record<string, [number, number, number]>,
): void {
  const preset = themes[name as ThemeName] ?? themes.default;
  for (const key of Object.keys(theme) as (keyof typeof theme)[]) {
    if (preset[key]) theme[key] = preset[key] as RgbTuple;
  }
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (
        key in theme &&
        Array.isArray(val) &&
        val.length === 3 &&
        val.every((n) => typeof n === "number")
      ) {
        (theme as Record<string, RgbTuple>)[key] = [
          val[0],
          val[1],
          val[2],
        ] as RgbTuple;
      }
    }
  }
}

// Convert RGB tuple to "rgb(r,g,b)" string for nib-ink's <Text color={...}> prop
export function toRgb(c: RgbTuple): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function thresholdRgb(
  pct: number,
  thresholds: [number, number, number],
): RgbTuple {
  const [t1, t2, t3] = thresholds;
  if (pct >= t3) return theme.red;
  if (pct >= t2) return theme.orange;
  if (pct >= t1) return theme.yellow;
  return theme.green;
}

export function ctxRgb(pct: number): RgbTuple {
  return thresholdRgb(pct, [40, 50, 70]);
}

export function rateRgb(pct: number): RgbTuple {
  return thresholdRgb(pct, [50, 70, 90]);
}

export function formatTokensCompact(num: number): string {
  if (num >= 1_000_000) {
    const d = Math.floor((num * 10) / 1_000_000);
    return `${Math.floor(d / 10)}.${d % 10}m`;
  }
  if (num >= 1000) return `${Math.floor(num / 1000)}k`;
  return `${num}`;
}

export function countdownFromEpoch(epoch: number, nowEpoch: number): string {
  if (!epoch || isNaN(epoch)) return "";
  const r = epoch - nowEpoch;
  if (r <= 0) return "now";
  const d = Math.floor(r / 86400);
  const h = Math.floor((r % 86400) / 3600);
  const m = Math.floor((r % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function countdownFromIso(iso: string, nowEpoch: number): string {
  if (!iso || iso === "null") return "";
  return countdownFromEpoch(
    Math.floor(new Date(iso).getTime() / 1000),
    nowEpoch,
  );
}

export function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function fileMtime(path: string): number {
  try {
    return Math.floor(statSync(path).mtimeMs / 1000);
  } catch {
    return 0;
  }
}

export function writeFileSafe(path: string, content: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  } catch {
    /* ignore */
  }
}

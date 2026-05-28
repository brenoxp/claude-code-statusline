/**
 * Generate example SVG from statusline ANSI output.
 * Feeds mock input JSON to the built dist/index.js, captures ANSI, converts to SVG.
 *
 * Usage: bun scripts/generate-example-svg.ts [--out examples/statusline.svg]
 * Requires: bun run build first
 */
import { execSync } from "child_process";
import { parseArgs } from "util";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "examples/statusline.svg" },
  },
});

// Rich mock input with all features visible
const mockInput = JSON.stringify({
  session_id: "example-0000-0000-0000-000000000000",
  cwd: "~/projects/myapp",
  model: { id: "claude-opus-4-6-20260101", display_name: "Opus 4.6" },
  version: "2.2.0",
  context_window: {
    context_window_size: 200000,
    current_usage: {
      input_tokens: 2500,
      output_tokens: 1200,
      cache_creation_input_tokens: 18500,
      cache_read_input_tokens: 45800,
    },
  },
  // Explicit rate_limits so the SVG is self-contained and deterministic. Without
  // these, getUsageData falls back to the local cache and would leak the
  // generating machine's real usage into the committed image. Mirrors the
  // examples/input_with_context.json fixture (epochs picked for nice countdowns).
  rate_limits: {
    five_hour: { used_percentage: 23.5, resets_at: 1780005495 },
    seven_day: { used_percentage: 41.2, resets_at: 1780440375 },
  },
});

const ansiOutput = execSync(
  `COLUMNS=75 bun dist/index.js`,
  { input: mockInput, encoding: "utf8", timeout: 10000 },
);

// ANSI-to-SVG conversion
interface StyledSpan {
  text: string;
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
}

const DEFAULT_FG = "#abb2bf";
const DEFAULT_BG = "#282c34";

function hex(n: number): string {
  return (n ?? 0).toString(16).padStart(2, "0");
}

function parseAnsiToSpans(ansiStr: string): StyledSpan[][] {
  const lines = ansiStr.split("\n");
  const result: StyledSpan[][] = [];
  let fg: string | null = null;
  let bg: string | null = null;
  let bold = false;
  let dim = false;

  for (const line of lines) {
    const spans: StyledSpan[] = [];
    let currentText = "";
    const regex = /\x1b\[([0-9;]*)m|([^\x1b]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match[2] !== undefined) {
        currentText += match[2];
      } else if (match[1] !== undefined) {
        if (currentText) {
          spans.push({ text: currentText, fg, bg, bold, dim });
          currentText = "";
        }
        const codes = match[1].split(";").map(Number).filter((n) => !isNaN(n));
        if (codes.length === 0) codes.push(0);
        for (let i = 0; i < codes.length; i++) {
          const code = codes[i];
          if (code === 0) { fg = null; bg = null; bold = false; dim = false; }
          else if (code === 1) bold = true;
          else if (code === 2) dim = true;
          else if (code === 22) { bold = false; dim = false; }
          else if (code === 39) fg = null;
          else if (code === 49) bg = null;
          else if (code === 38 && codes[i + 1] === 2) {
            fg = `#${hex(codes[i + 2])}${hex(codes[i + 3])}${hex(codes[i + 4])}`;
            i += 4;
          } else if (code === 48 && codes[i + 1] === 2) {
            bg = `#${hex(codes[i + 2])}${hex(codes[i + 3])}${hex(codes[i + 4])}`;
            i += 4;
          }
        }
      }
    }
    if (currentText) spans.push({ text: currentText, fg, bg, bold, dim });
    result.push(spans);
  }
  return result;
}

function dimColor(color: string): string {
  if (!color.startsWith("#") || color.length !== 7) return color;
  // Blend toward a visible dim gray floor so dark colors stay readable on dark bg
  const floor = 0x50;
  const blend = (ch: number) => Math.max(floor, Math.round(ch * 0.75));
  const r = blend(parseInt(color.slice(1, 3), 16));
  const g = blend(parseInt(color.slice(3, 5), 16));
  const b = blend(parseInt(color.slice(5, 7), 16));
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function spansToSvg(lines: StyledSpan[][], title: string): string {
  const CW = 8.4, LH = 20, PX = 16, PY = 12, TB = 36, BR = 8;

  let maxCols = 0;
  for (const line of lines) {
    let cols = 0;
    for (const s of line) cols += s.text.length;
    if (cols > maxCols) maxCols = cols;
  }
  while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();

  const w = maxCols * CW + PX * 2;
  const h = lines.length * LH + PY * 2 + TB;
  const font = `font-family="'SF Mono','Cascadia Code','Fira Code','JetBrains Mono',Menlo,Monaco,Consolas,monospace"`;
  const p: string[] = [];

  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
  p.push(`  <rect width="${w}" height="${h}" rx="${BR}" fill="${DEFAULT_BG}" />`);
  p.push(`  <rect width="${w}" height="${TB}" rx="${BR}" fill="#21252b" />`);
  p.push(`  <rect y="${TB - BR}" width="${w}" height="${BR}" fill="#21252b" />`);
  p.push(`  <circle cx="20" cy="18" r="6" fill="#e06c75" />`);
  p.push(`  <circle cx="40" cy="18" r="6" fill="#e5c07b" />`);
  p.push(`  <circle cx="60" cy="18" r="6" fill="#98c379" />`);
  p.push(`  <text x="${w / 2}" y="22" text-anchor="middle" ${font} font-size="12" fill="#5c6370">${escapeXml(title)}</text>`);

  for (let li = 0; li < lines.length; li++) {
    const y = TB + PY + li * LH + 14;
    let x = PX;
    for (const s of lines[li]) {
      if (!s.text) continue;
      let fg = s.fg ?? DEFAULT_FG;
      if (s.dim) fg = dimColor(fg);
      const tw = s.text.length * CW;
      if (s.bg) p.push(`  <rect x="${x}" y="${y - 14}" width="${tw}" height="${LH}" fill="${s.bg}" />`);
      const attrs = [`x="${x}"`, `y="${y}"`, `fill="${fg}"`, font, `font-size="14"`, `xml:space="preserve"`];
      if (s.bold) attrs.push(`font-weight="bold"`);
      p.push(`  <text ${attrs.join(" ")}>${escapeXml(s.text)}</text>`);
      x += tw;
    }
  }

  p.push("</svg>");
  return p.join("\n");
}

const styledLines = parseAnsiToSpans(ansiOutput);
const svg = spansToSvg(styledLines, "claude-code-statusline");

const outPath = resolve(values.out!);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, svg);
process.stderr.write(`Written to ${outPath}\n`);

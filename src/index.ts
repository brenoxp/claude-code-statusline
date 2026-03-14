// Claude Code custom statusline - nib-ink (Svelte 5) version
// Reads JSON from stdin, outputs ANSI-formatted status lines via renderToString

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderToString, setTheme } from "nib-ink";
import Statusline from "./components/Statusline.svelte";
import { gatherData } from "./lib/data";
import { formatTokensCompact } from "./lib/theme";

const __dirname = dirname(fileURLToPath(import.meta.url));

setTheme("light");

// Load settings.json from project root (one level up from dist/)
interface Settings {
  debug?: boolean;
  testMode?: boolean;
  log?: boolean;
  maxLineWidth?: number;
  minPromptLineWidth?: number;
  cacheWrite?: boolean;
}
let settings: Settings = {};
try {
  settings = JSON.parse(
    readFileSync(join(__dirname, "..", "settings.json"), "utf8"),
  );
} catch {}

const debug = settings.debug || process.env.STATUSLINE_DEBUG === "true";
const testMode = settings.testMode || process.env.TEST_MODE === "true";
const logInput = settings.log || process.env.STATUSLINE_LOG === "true";
const maxLineWidth = settings.maxLineWidth ?? null;
const minPromptLineWidth = settings.minPromptLineWidth ?? null;
const cacheWrite = settings.cacheWrite ?? false;

const startTime = debug ? performance.now() : 0;

function detectColumns(): number {
  if (process.stdout.columns) return process.stdout.columns;
  const env = parseInt(process.env.COLUMNS as string, 10);
  if (env > 0) return env;
  try {
    let pid = process.ppid;
    for (let i = 0; i < 5; i++) {
      const info = execSync(`ps -p ${pid} -o tty=,ppid=`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const [tty, ppid] = info.split(/\s+/);
      if (tty && tty !== "??" && tty !== "?") {
        const size = execSync(`stty size < /dev/${tty}`, {
          encoding: "utf8",
          shell: true,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        const cols = parseInt(size.split(" ")[1], 10);
        if (cols > 0) return cols;
      }
      pid = parseInt(ppid, 10);
      if (!pid || pid === 1 || pid === 0) break;
    }
  } catch {}
  return 80;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let raw: string;
  if (testMode) {
    const testFile = join(
      __dirname,
      "..",
      "examples",
      "input_with_context.json",
    );
    raw = readFileSync(testFile, "utf8");
  } else {
    raw = await readStdin();
  }

  const input = JSON.parse(raw);

  if (logInput) {
    const logsDir = join(__dirname, "..", "logs");
    mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(logsDir, `${ts}.json`), JSON.stringify(input, null, 2));
  }

  const termWidth = detectColumns();

  let statusLineWidthPadding = 4;

  // When claude code terminal width becomes bigger than 80 COLUMNS
  // It has the following config: Left: 2 - Right: 3
  if (termWidth >= 80) {
    statusLineWidthPadding = 5;
  }

  let maxWidth = termWidth - statusLineWidthPadding;
  if (maxLineWidth != null) maxWidth = Math.min(maxWidth, maxLineWidth);

  const t0 = debug ? performance.now() : 0;
  const data = await gatherData(input, { cacheWrite });
  // Calculate widest non-prompt line to cap prompt width
  const lineWidths: number[] = [];
  // Location: path + gap(2) + branch + gap(2) + additions + gap(2) + deletions
  const locParts = [data.path?.length ?? 0];
  if (data.branch) locParts.push(2, data.branch.length);
  if (data.additions != null) locParts.push(2, `+${data.additions}`.length);
  if (data.deletions != null) locParts.push(2, `-${data.deletions}`.length);
  lineWidths.push(
    Math.min(
      locParts.reduce((a, b) => a + b, 0),
      maxWidth,
    ),
  );
  // ContextBar: model(8) + gap(2) + bar(21) + gap(2) + pct(4) + gap(2) + tokens + gap(2) + cacheWrite
  let ctxWidth =
    8 +
    2 +
    21 +
    2 +
    4 +
    2 +
    (data.tokenCount ? String(data.tokenCount).length + 1 : 0);
  if (data.cacheWriteTokens > 0)
    ctxWidth += 2 + 1 + formatTokensCompact(data.cacheWriteTokens).length;
  lineWidths.push(ctxWidth);
  // Session/Weekly: label(8) + gap(2) + bar(21) + gap(2) + pct(4) + gap(2) + countdown + gap(2) + promo
  if (data.session) {
    let sw = 8 + 2 + 21 + 2 + 4;
    if (data.session.resetCountdown)
      sw += 2 + data.session.resetCountdown.length;
    if (data.session.promoStatus)
      sw +=
        2 +
        (data.session.promoStatus.active
          ? `⚡2x ${data.session.promoStatus.time} left`.length + 1
          : `⚡2x in ${data.session.promoStatus.time}`.length + 1);
    lineWidths.push(sw);
  }
  if (data.weekly) {
    let ww = 8 + 2 + 21 + 2 + 4;
    if (data.weekly.resetCountdown) ww += 2 + data.weekly.resetCountdown.length;
    lineWidths.push(ww);
  }
  // Processes: "◆ X cli" + gap(2) + "◇ X mcp"
  lineWidths.push(
    `◆ ${data.cliCount} cli`.length + 1 + 2 + `◇ ${data.mcpCount} mcp`.length,
  );
  // Tasks
  if (data.completedTask) lineWidths.push(2 + data.completedTask.length);
  if (data.currentTask) lineWidths.push(2 + data.currentTask.length);
  // Clock: "XX:XX AM"
  lineWidths.push(8);

  const maxOtherLineWidth = Math.min(Math.max(...lineWidths), maxWidth);
  const maxPromptLineWidth =
    maxOtherLineWidth > 0 ? maxOtherLineWidth : maxWidth;

  const props = { ...data, maxWidth, minPromptLineWidth, maxPromptLineWidth };
  const t1 = debug ? performance.now() : 0;

  const output = await renderToString(Statusline, props, {
    columns: maxWidth,
    ...(debug && { debug: true }),
  } as any);
  const t2 = debug ? performance.now() : 0;

  const padded = output
    .split("\n")
    .map((line) => {
      return line + " ".repeat(Math.max(0, termWidth - maxWidth));
    })
    .join("\n");
  process.stdout.write(padded + "\n");

  if (debug) {
    const total = ((performance.now() - startTime) / 1000).toFixed(3);
    const gather = (t1 - t0).toFixed(1);
    const render = (t2 - t1).toFixed(1);
    process.stderr.write(
      `total: ${total}s  gather: ${gather}ms  render: ${render}ms\n`,
    );
  }
}

main().catch((err) => {
  if (debug)
    process.stderr.write(`statusline error: ${err.stack || err.message}\n`);
  process.exit(1);
});

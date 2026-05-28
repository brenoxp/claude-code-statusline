// Claude Code custom statusline - nib-ink (Svelte 5) version
// Reads JSON from stdin, outputs ANSI-formatted status lines via renderToString

// nib-ink falls back to Bun.stringWidth for any text outside the ASCII printable
// range + a tiny unicode allowlist. Under node, that throws ReferenceError and
// the whole statusline disappears as soon as the user types accented/unicode
// chars (Portuguese é/ã/ç, em dashes, emoji, etc). Polyfill before any nib-ink
// import touches it.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
(globalThis as any).Bun ??= {
  stringWidth(text: string, opts?: { countAnsiEscapeCodes?: boolean }) {
    const stripped =
      opts?.countAnsiEscapeCodes === false ? text.replace(ANSI_RE, "") : text;
    // Count visible code points; treat each as width 1. Good enough for a
    // truncation budget — wide-char (CJK, emoji) under-counts but doesn't crash.
    let n = 0;
    for (const _ of stripped) n++;
    return n;
  },
};

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { renderToString, setTheme } from "nib-ink";
import Statusline from "./components/Statusline.svelte";
import { gatherData } from "./lib/data";
import { formatTokensCompact, applyTheme } from "./lib/theme";
import { getCurrentVersion, checkForUpdates } from "./lib/update-check";

const __dirname = dirname(fileURLToPath(import.meta.url));

setTheme("light");

// User config lives in ~/.claude/.statusline/. The packaged settings.json
// (one level up from dist/) is the dev/legacy default; user config wins.
interface Settings {
  theme?: string;
  colors?: Record<string, [number, number, number]>;
  debug?: boolean;
  testMode?: boolean;
  log?: boolean;
  maxLineWidth?: number;
  minPromptLineWidth?: number;
  cacheWrite?: boolean;
}

const CONFIG_DIR = join(homedir(), ".claude", ".statusline");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const CONFIG_DOC = join(CONFIG_DIR, "CLAUDE.md");
const UPDATE_CACHE_FILE = join(CONFIG_DIR, "update-check.json");

const DEFAULT_CONFIG: Settings = {
  theme: "default",
  colors: {},
  maxLineWidth: 70,
  minPromptLineWidth: 40,
  cacheWrite: true,
  debug: false,
  testMode: false,
  log: false,
};

const CONFIG_DOC_CONTENT = `# cc-statusline user config

This folder holds the user config for the cc-statusline binary (Claude Code custom statusline). Edit \`config.json\` to customize colors and behavior. Changes take effect on the next render; no rebuild needed for an installed binary.

## config.json fields
- \`theme\` — one of the 5 theme names below.
- \`colors\` — optional per-key RGB overrides applied on top of the theme, e.g. \`{ "green": [70,195,115] }\`. Each value is an \`[r,g,b]\` array (0-255).
- \`maxLineWidth\` (70) — cap on rendered line width.
- \`minPromptLineWidth\` (40) — minimum width reserved for the prompt line.
- \`cacheWrite\` (true) — show cache-creation tokens (the ✎ indicator).
- \`debug\` (false) — write timing info to stderr.
- \`testMode\` (false) — render from the packaged examples instead of stdin.
- \`log\` (false) — save each stdin JSON payload to a logs/ dir.

## Themes
- \`default\`
- \`tokyo-night\`
- \`dracula\`
- \`gruvbox\`
- \`nord\`

To change theme, set the \`theme\` field. To tweak individual colors, add entries to the \`colors\` map (overrides win over the theme).

## Color keys (12)
- \`green\` — success / path
- \`yellow\` — warn threshold (low)
- \`orange\` — warn threshold (high)
- \`red\` — critical threshold
- \`model\` — model-name accent
- \`label\` — dim labels
- \`slate\` — muted secondary text
- \`purple\` — accent
- \`muted\` — general text
- \`prompt\` — prompt text
- \`barDim\` — progress bar base color
- \`barLerp\` — progress bar bright target color

The \`/statusline:config\` skill can reconfigure this interactively.
`;

// Ensure the user config folder exists and seed config.json + CLAUDE.md on
// first run. Never throws: the statusline must render even if the FS is hostile.
function bootstrap(): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    if (!existsSync(CONFIG_FILE)) {
      writeFileSync(
        CONFIG_FILE,
        JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
      );
    }
    if (!existsSync(CONFIG_DOC)) {
      writeFileSync(CONFIG_DOC, CONFIG_DOC_CONTENT);
    }
  } catch {
    /* ignore — fall back to defaults */
  }
}

// Read packaged defaults then merge user config on top. Called inside main()
// so every render invocation gets a fresh read of config.json.
function loadSettings(): Settings {
  let settings: Settings = { ...DEFAULT_CONFIG };
  try {
    const packaged = JSON.parse(
      readFileSync(join(__dirname, "..", "settings.json"), "utf8"),
    );
    settings = { ...settings, ...packaged };
  } catch {}
  try {
    const userConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    settings = { ...settings, ...userConfig };
  } catch {}
  return settings;
}

// Module-level debug flag (env only) used by the .catch() handler below.
// Inside main(), settings.debug is OR'd in for the full effectiveDebug.
const debug = process.env.STATUSLINE_DEBUG === "true";
const startTime = performance.now();

function detectColumns(): number {
  // Claude Code injects COLUMNS for status line scripts (CC >= the release that
  // added COLUMNS/LINES env vars), so prefer it. Falls back to the legacy tty
  // sniffing below for older CC or non-interactive invocations.
  const env = parseInt(process.env.COLUMNS as string, 10);
  if (env > 0) return env;
  if (process.stdout.columns) return process.stdout.columns;
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
  // bootstrap() and loadSettings() are called inside main() (not at module
  // level) so config.json is re-read on every render invocation. CC spawns a
  // fresh process per render, so theme changes in one session are picked up by
  // all other sessions on their next render.
  bootstrap();
  const settings = loadSettings();
  applyTheme(settings.theme ?? "default", settings.colors);

  const effectiveDebug = settings.debug || debug;
  const testMode = settings.testMode || process.env.TEST_MODE === "true";
  const logInput = settings.log || process.env.STATUSLINE_LOG === "true";
  const maxLineWidth = settings.maxLineWidth ?? null;
  const minPromptLineWidth = settings.minPromptLineWidth ?? null;
  const cacheWrite = settings.cacheWrite ?? false;

  const currentVersion = getCurrentVersion(
    join(__dirname, "..", "package.json"),
  );
  const latestVersion = checkForUpdates(currentVersion, UPDATE_CACHE_FILE);

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

  const t0 = effectiveDebug ? performance.now() : 0;
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
  // Session/Weekly: label(8) + gap(2) + bar(21) + gap(2) + pct(4) + gap(2) + countdown
  if (data.session) {
    let sw = 8 + 2 + 21 + 2 + 4;
    if (data.session.resetCountdown)
      sw += 2 + data.session.resetCountdown.length;
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

  const props = {
    ...data,
    maxWidth,
    minPromptLineWidth,
    maxPromptLineWidth,
    latestVersion,
  };
  const t1 = effectiveDebug ? performance.now() : 0;

  const output = await renderToString(Statusline, props, {
    columns: maxWidth,
    ...(effectiveDebug && { debug: true }),
  } as any);
  const t2 = effectiveDebug ? performance.now() : 0;

  const padded = output
    .split("\n")
    .map((line) => {
      return line + " ".repeat(Math.max(0, termWidth - maxWidth));
    })
    .join("\n");
  process.stdout.write(padded + "\n");

  if (effectiveDebug) {
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

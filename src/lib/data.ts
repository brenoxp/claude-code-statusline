import { exec } from "node:child_process";
import {
  existsSync,
  readFileSync,
  openSync,
  readSync,
  closeSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  countdownFromEpoch,
  readFileSafe,
  fileMtime,
  writeFileSafe,
} from "./theme";

const CACHE_DIR = join(homedir(), ".claude", "cache", "statusline");

function execAsync(
  cmd: string,
  opts: { cwd?: string; encoding?: string } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, encoding: "utf8" as any }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString().trim());
    });
  });
}

export interface StatuslineProps {
  // Location
  path: string;
  branch: string | null;
  additions: number | null;
  deletions: number | null;
  // Context
  modelName: string;
  contextPct: number;
  tokenCount: number;
  cacheWriteTokens: number;
  // Usage limits (from input.rate_limits)
  session: {
    pct: number;
    resetCountdown: string;
  } | null;
  weekly: {
    pct: number;
    resetCountdown: string;
  } | null;
  // Processes
  cliCount: number;
  mcpCount: number;
  // Tasks
  completedTask: string | null;
  currentTask: string | null;
  // Prompt
  promptText: string | null;
  isVoice: boolean;
  // Layout
  maxWidth: number;
}

async function getLocationData(input: any) {
  const cwd = input.cwd || "";
  const home = homedir();
  const path = cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;

  let branch: string | null = null;
  let additions: number | null = null;
  let deletions: number | null = null;

  // Cache git data for 5s
  const cacheFile = join(CACHE_DIR, "git-data.json");
  const now = Math.floor(Date.now() / 1000);
  if (now - fileMtime(cacheFile) < 5) {
    const cached = readFileSafe(cacheFile);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.cwd === cwd) {
          return {
            path,
            branch: data.branch ?? null,
            additions: data.additions ?? null,
            deletions: data.deletions ?? null,
          };
        }
      } catch {}
    }
  }

  if (existsSync(cwd)) {
    try {
      const out = await execAsync(
        'git rev-parse --git-dir > /dev/null && echo "---BRANCH---" && git branch --show-current && echo "---DIFF---" && git diff --numstat',
        { cwd },
      );

      const branchStart = out.indexOf("---BRANCH---");
      const diffStart = out.indexOf("---DIFF---");
      if (branchStart >= 0 && diffStart >= 0) {
        branch = out.slice(branchStart + 12, diffStart).trim() || null;

        if (branch) {
          const numstat = out.slice(diffStart + 10).trim();
          if (numstat) {
            let added = 0,
              removed = 0;
            for (const line of numstat.split("\n")) {
              const [a, r] = line.split("\t");
              added += parseInt(a, 10) || 0;
              removed += parseInt(r, 10) || 0;
            }
            if (added) additions = added;
            if (removed) deletions = removed;
          }
        }
      }
    } catch {}
  }

  writeFileSafe(
    cacheFile,
    JSON.stringify({ cwd, branch, additions, deletions }) + "\n",
  );
  return { path, branch, additions, deletions };
}

function sumSessionCacheTokens(transcriptPath: string | undefined): number {
  if (!transcriptPath) return 0;
  const resolved = transcriptPath.replace(/^~/, process.env.HOME || "");

  let raw: string;
  try {
    raw = readFileSync(resolved, "utf8");
  } catch {
    return 0;
  }

  let total = 0;
  for (const line of raw.split("\n")) {
    if (!line || !line.includes("cache_creation_input_tokens")) continue;
    try {
      const entry = JSON.parse(line);
      total += entry.message?.usage?.cache_creation_input_tokens || 0;
    } catch {}
  }
  return total;
}

function getContextData(input: any, cacheWrite: boolean) {
  const modelName = (input.model?.display_name || "Unknown").replace(
    / \d.*/,
    "",
  );
  const windowSize = input.context_window?.context_window_size || 200000;
  const u = input.context_window?.current_usage || {};
  const totalUsed =
    (u.input_tokens || 0) +
    (u.output_tokens || 0) +
    (u.cache_creation_input_tokens || 0) +
    (u.cache_read_input_tokens || 0);
  const contextPct =
    windowSize > 0 ? Math.floor((totalUsed * 100) / windowSize) : 0;

  const cacheWriteTokens = cacheWrite
    ? sumSessionCacheTokens(input.transcript_path)
    : 0;

  return { modelName, contextPct, tokenCount: totalUsed, cacheWriteTokens };
}

// Rate limits come straight from the stdin JSON (input.rate_limits), which Claude
// Code populates for Pro/Max subscribers after the first API response. Each window
// (five_hour / seven_day) may be independently absent. resets_at is epoch seconds.
function getUsageData(input: any) {
  const rateLimits = input.rate_limits;
  if (!rateLimits) return { session: null, weekly: null };

  const now = Math.floor(Date.now() / 1000);

  const window = (w: any) =>
    w
      ? {
          pct: Math.round(w.used_percentage || 0),
          resetCountdown: countdownFromEpoch(w.resets_at || 0, now),
        }
      : null;

  return {
    session: window(rateLimits.five_hour),
    weekly: window(rateLimits.seven_day),
  };
}

async function getProcessData() {
  const cacheFile = join(CACHE_DIR, "processes-data.json");
  const now = Math.floor(Date.now() / 1000);

  if (now - fileMtime(cacheFile) < 10) {
    const cached = readFileSafe(cacheFile);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return { cliCount: data.cli || 0, mcpCount: data.mcp || 0 };
      } catch {}
    }
  }

  let cli = 0,
    mcp = 0;
  try {
    const out = await execAsync(
      "ps aux | grep -E '/claude( |$)' | grep -v grep",
    );

    if (out) {
      const pids = out
        .split("\n")
        .map((l: string) => l.trim().split(/\s+/)[1])
        .filter(Boolean);
      cli = pids.length;

      if (pids.length) {
        const pgrepCmd = pids
          .map(
            (pid) =>
              `(pgrep -P ${pid} 2>/dev/null | xargs -I{} ps -p {} -o command= 2>/dev/null | grep -cE '(mcp|context7)' 2>/dev/null || echo 0)`,
          )
          .join('; echo "---"; ');

        try {
          const mcpOut = await execAsync(pgrepCmd);
          for (const part of mcpOut.split("---")) {
            mcp += parseInt(part.trim(), 10) || 0;
          }
        } catch {}
      }
    }
  } catch {}

  writeFileSafe(cacheFile, JSON.stringify({ cli, mcp }) + "\n");

  return { cliCount: cli, mcpCount: mcp };
}

function getTasksData(input: any) {
  const sessionId = input.session_id;
  if (!sessionId) return { completedTask: null, currentTask: null };

  const tasksFile = join(
    homedir(),
    ".claude",
    "session-tasks",
    `${sessionId}.json`,
  );
  const raw = readFileSafe(tasksFile);
  if (!raw) return { completedTask: null, currentTask: null };

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { completedTask: null, currentTask: null };
  }
  if (!data.tasks || !Array.isArray(data.tasks))
    return { completedTask: null, currentTask: null };

  const doneTasks = data.tasks.filter((t: any) => t.status === "done");
  const currentTasks = data.tasks.filter((t: any) => t.status === "current");

  const completedTask = doneTasks.length
    ? doneTasks[doneTasks.length - 1].text
    : null;
  const currentTask = currentTasks.length
    ? currentTasks[currentTasks.length - 1].text
    : null;

  return { completedTask, currentTask };
}

const NOISE_PATTERNS = [
  "<command-message>",
  "<command-name>",
  "<local-command-stdout>",
  "<bash-input>",
  "<bash-stdout>",
  "<bash-stderr>",
  "<command-args>",
  "Caveat: The messages below",
];

function getPromptData(input: any) {
  const transcriptPath = input.transcript_path;
  if (!transcriptPath) return { promptText: null, isVoice: false };

  const resolved = transcriptPath.replace(/^~/, process.env.HOME || "");

  let raw: string;
  try {
    const stat = statSync(resolved);
    const TAIL_BYTES = 16384;
    if (stat.size > TAIL_BYTES) {
      const fd = openSync(resolved, "r");
      const buf = Buffer.alloc(TAIL_BYTES);
      readSync(fd, buf, 0, TAIL_BYTES, stat.size - TAIL_BYTES);
      closeSync(fd);
      raw = buf.toString("utf8");
      const nl = raw.indexOf("\n");
      if (nl >= 0) raw = raw.slice(nl + 1);
    } else {
      raw = readFileSync(resolved, "utf8");
    }
  } catch {
    return { promptText: null, isVoice: false };
  }

  const lines = raw.trimEnd().split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    let entry: any;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }

    if (entry.type !== "user") continue;
    const content = entry.message?.content;
    if (!content) continue;

    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      const textBlock = content.find((c: any) => c.type === "text");
      if (textBlock) text = textBlock.text;
    }

    if (!text) continue;
    text = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (NOISE_PATTERNS.some((p) => text.includes(p))) continue;

    let isVoice = false;
    if (text.includes("<audio>")) {
      text = text.replace(/<\/?audio>/g, "").trim();
      isVoice = true;
    }

    return { promptText: text, isVoice };
  }

  return { promptText: null, isVoice: false };
}

export async function gatherData(
  input: any,
  opts: { cacheWrite?: boolean } = {},
): Promise<Omit<StatuslineProps, "maxWidth">> {
  // Sync data (pure computation, no I/O cost)
  const context = getContextData(input, opts.cacheWrite ?? false);
  const tasks = getTasksData(input);
  const prompt = getPromptData(input);
  const usage = getUsageData(input);

  // Async data (subprocess spawns) - run in parallel
  const [location, processes] = await Promise.all([
    getLocationData(input),
    getProcessData(),
  ]);

  return {
    ...location,
    ...context,
    ...usage,
    ...processes,
    ...tasks,
    ...prompt,
  };
}

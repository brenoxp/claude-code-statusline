// Fetches Claude API usage data, caches for 60s
// Reads OAuth token from: env var > macOS keychain > creds file

import { execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import https from "node:https";
import { fileMtime, writeFileSafe, readFileSafe } from "./theme";

const CACHE_MAX_AGE = 60;
const BACKOFF = 300;
const CACHE_DIR = join(homedir(), ".claude", "cache", "statusline");

function logEvent(msg: string) {
  const logFile = join(CACHE_DIR, "usage-fetch.log");
  try {
    const ts = new Date().toTimeString().slice(0, 8);
    writeFileSafe(logFile, "");
    const existing = readFileSafe(logFile) || "";
    writeFileSync(logFile, existing + `${ts} ${msg}\n`);
  } catch {
    /* ignore */
  }
}

function getOAuthToken(): string | null {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN)
    return process.env.CLAUDE_CODE_OAUTH_TOKEN;

  // macOS keychain
  try {
    const blob = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    if (blob) {
      const parsed = JSON.parse(blob);
      const token = parsed?.claudeAiOauth?.accessToken;
      if (token && token !== "null") return token;
    }
  } catch {
    /* not on macOS or no keychain entry */
  }

  // Creds file
  const credsFile = join(homedir(), ".claude", ".credentials.json");
  const raw = readFileSafe(credsFile);
  if (raw) {
    try {
      const token = JSON.parse(raw)?.claudeAiOauth?.accessToken;
      if (token && token !== "null") return token;
    } catch {
      /* ignore */
    }
  }

  return null;
}

function httpGet(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

const WINDOW_LOG = join(homedir(), ".claude", "logs", "usage-windows.log");

function detectWindowReset(cacheFile: string, newData: any) {
  try {
    const prev = readFileSafe(cacheFile);
    if (!prev) return;
    const prevData = JSON.parse(prev);
    const prevPct = prevData.five_hour?.utilization || 0;
    const newPct = newData.five_hour?.utilization || 0;
    if (prevPct > 5 && newPct < prevPct - 5) {
      const ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      const line = `${ts}\t${Math.round(prevPct)}% -> ${Math.round(newPct)}%\n`;
      appendFileSync(WINDOW_LOG, line);
    }
  } catch {
    /* ignore */
  }
}

export async function fetchUsage(): Promise<string | null> {
  mkdirSync(CACHE_DIR, { recursive: true });

  const cacheFile = join(CACHE_DIR, "usage.json");
  const failFile = join(CACHE_DIR, "usage-fetch.failtime");
  const lockFile = join(CACHE_DIR, "usage-fetch.lock");
  const now = Math.floor(Date.now() / 1000);

  const emitCache = () => readFileSafe(cacheFile);
  const cacheIsFresh = () =>
    existsSync(cacheFile) && now - fileMtime(cacheFile) < CACHE_MAX_AGE;

  // Backoff on recent failure
  if (existsSync(failFile)) {
    const lastFail = parseInt(readFileSafe(failFile) || "0", 10);
    if (now - lastFail < BACKOFF) return emitCache();
  }

  if (cacheIsFresh()) return readFileSync(cacheFile, "utf8");

  // Simple lock
  if (existsSync(lockFile) && now - fileMtime(lockFile) < 30)
    return emitCache();
  try {
    writeFileSync(lockFile, String(process.pid));
  } catch {
    return emitCache();
  }

  try {
    if (cacheIsFresh()) return readFileSync(cacheFile, "utf8");

    const token = getOAuthToken();
    if (!token) return emitCache();

    const body = await httpGet("https://api.anthropic.com/api/oauth/usage", {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
    });

    const data = JSON.parse(body);
    if (!data.five_hour) {
      logEvent("api-fail");
      writeFileSafe(failFile, String(now));
      return emitCache();
    }

    data.fetched_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    detectWindowReset(cacheFile, data);

    const enriched = JSON.stringify(data);
    logEvent("fetch");
    try {
      unlinkSync(failFile);
    } catch {
      /* ok */
    }
    writeFileSync(cacheFile, enriched);
    return enriched;
  } catch {
    logEvent("api-fail");
    writeFileSafe(failFile, String(now));
    return emitCache();
  } finally {
    try {
      unlinkSync(lockFile);
    } catch {
      /* ok */
    }
  }
}

// Run standalone (for background refresh spawned by data.ts)
const isStandalone =
  process.argv[1] &&
  (process.argv[1].endsWith("usage-fetch.ts") ||
    process.argv.includes("--fetch-usage"));
if (isStandalone) {
  fetchUsage().then((r) => {
    if (r) process.stdout.write(r);
  });
}

// Fetches Claude API usage data, caches for 60s
// Reads OAuth token from: env var > macOS keychain > creds file
//
// Recovery / when statusline shows stale or "api-fail":
//   1) Clear cache state:
//        rm -f ~/.claude/cache/statusline/usage-fetch.{lock,failtime} \
//              ~/.claude/cache/statusline/usage.json
//   2) If API still fails, verify the OAuth token:
//        security find-generic-password -s "Claude Code-credentials" -w
//   3) Tail the log to see what the fetcher last did:
//        tail ~/.claude/cache/statusline/usage-fetch.log
//
// Self-healing built in:
//   - Locks older than LOCK_MAX_AGE (orphaned by SIGKILL) are removed.
//   - failtime older than FAILTIME_MAX_AGE is treated as expired.
//   - Log is rotated at LOG_MAX_BYTES so it doesn't grow unbounded.

import { execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  statSync,
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
const FAILTIME_MAX_AGE = 3600; // expire orphan failtime after 1h
const LOCK_MAX_AGE = 30; // hold lock at most 30s; older = orphan
const LOG_MAX_BYTES = 64 * 1024;
const CACHE_DIR = join(homedir(), ".claude", "cache", "statusline");

function logEvent(msg: string) {
  const logFile = join(CACHE_DIR, "usage-fetch.log");
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    if (existsSync(logFile)) {
      try {
        const size = statSync(logFile).size;
        if (size > LOG_MAX_BYTES) {
          // Keep last half: read tail, rewrite
          const buf = readFileSync(logFile, "utf8");
          writeFileSync(logFile, buf.slice(-Math.floor(LOG_MAX_BYTES / 2)));
        }
      } catch {
        /* ignore rotation errors */
      }
    }
    const ts = new Date().toTimeString().slice(0, 8);
    appendFileSync(logFile, `${ts} ${msg}\n`);
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
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode || 0, body }),
      );
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

  // Backoff on recent failure (expire stale failtime to avoid orphan stuck-state)
  if (existsSync(failFile)) {
    const lastFail = parseInt(readFileSafe(failFile) || "0", 10);
    if (now - lastFail > FAILTIME_MAX_AGE) {
      try {
        unlinkSync(failFile);
        logEvent("failtime-expired");
      } catch {
        /* ignore */
      }
    } else if (now - lastFail < BACKOFF) {
      return emitCache();
    }
  }

  if (cacheIsFresh()) return readFileSync(cacheFile, "utf8");

  // Lock: another process is fetching. If lock is older than LOCK_MAX_AGE,
  // treat as orphan (likely SIGKILL'd before its finally{}) and remove.
  if (existsSync(lockFile)) {
    if (now - fileMtime(lockFile) < LOCK_MAX_AGE) return emitCache();
    try {
      unlinkSync(lockFile);
      logEvent("lock-orphan-removed");
    } catch {
      /* ignore */
    }
  }
  try {
    writeFileSync(lockFile, String(process.pid));
  } catch {
    return emitCache();
  }

  try {
    if (cacheIsFresh()) return readFileSync(cacheFile, "utf8");

    const token = getOAuthToken();
    if (!token) return emitCache();

    const { status, body } = await httpGet(
      "https://api.anthropic.com/api/oauth/usage",
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
    );

    if (status !== 200) {
      logEvent(`api-fail http=${status} body=${body.slice(0, 200).replace(/\s+/g, " ")}`);
      writeFileSafe(failFile, String(now));
      return emitCache();
    }

    let data: { five_hour?: unknown; seven_day?: unknown; fetched_at?: string };
    try {
      data = JSON.parse(body);
    } catch (e) {
      logEvent(`api-fail parse=${(e as Error).message} body=${body.slice(0, 200).replace(/\s+/g, " ")}`);
      writeFileSafe(failFile, String(now));
      return emitCache();
    }
    if (!data.five_hour) {
      logEvent(`api-fail no-five_hour body=${body.slice(0, 200).replace(/\s+/g, " ")}`);
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
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    logEvent(`api-fail err=${msg}`);
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

export interface UsageHealth {
  apiFailed: boolean;
  failAgeSecs: number | null;
}

export function getUsageHealth(): UsageHealth {
  const failFile = join(CACHE_DIR, "usage-fetch.failtime");
  if (!existsSync(failFile)) return { apiFailed: false, failAgeSecs: null };
  const lastFail = parseInt(readFileSafe(failFile) || "0", 10);
  if (!lastFail) return { apiFailed: false, failAgeSecs: null };
  const ageSecs = Math.floor(Date.now() / 1000) - lastFail;
  return { apiFailed: true, failAgeSecs: ageSecs };
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

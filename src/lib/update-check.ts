// Update checker: compares the installed version against the latest published
// on npm and surfaces a "newer version available" hint in the statusline.
// The network call is fire-and-forget and throttled, so rendering never blocks.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const NPM_PKG = "@brenoxp/cc-statusline";

// Read the installed version from the given package.json path.
export function getCurrentVersion(packageJsonPath: string): string {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Naive 3-segment integer compare (major.minor.patch). Returns true only when
// `a` is strictly greater than `b`. No prerelease/build-metadata handling —
// non-numeric segments become NaN and compare as equal. Fine for clean x.y.z.
export function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

// Fire-and-forget: query the npm registry's lightweight dist-tags JSON endpoint
// for the latest version and persist the result to `cacheFile`. Detached so it
// outlives the statusline process.
export function spawnVersionCheck(cacheFile: string): void {
  try {
    const distTagsUrl = `https://registry.npmjs.org/-/package/${NPM_PKG.replace("/", "%2F")}/dist-tags`;
    const script = `v=$(curl -fsSL "${distTagsUrl}" 2>/dev/null | sed -n 's/.*"latest":"\\([^"]*\\)".*/\\1/p'); t=$(date +%s); [ -n "$v" ] && printf '{"lastCheck":%s,"latestVersion":"%s"}\\n' "$t" "$v" > "$1"`;
    const child = spawn("sh", ["-c", script, "--", cacheFile], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {}
}

// Returns the latest version string when a newer release is available, null
// otherwise. Reads the cached result from a previous background check and
// triggers a fresh check at most once every 24 hours. `triggerCheck` is
// injectable for testing.
export function checkForUpdates(
  currentVersion: string,
  cacheFile: string,
  triggerCheck: (file: string) => void = spawnVersionCheck,
): string | null {
  try {
    const cache = JSON.parse(readFileSync(cacheFile, "utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (now - (cache.lastCheck ?? 0) > 86400) triggerCheck(cacheFile);
    if (cache.latestVersion && semverGt(cache.latestVersion, currentVersion)) {
      return cache.latestVersion as string;
    }
  } catch {
    // No cache file (or malformed) — spawn the first check.
    triggerCheck(cacheFile);
  }
  return null;
}

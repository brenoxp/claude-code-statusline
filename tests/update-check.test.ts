// Unit tests for the update checker. Run via `bun test tests/`.
import { test, expect } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  semverGt,
  checkForUpdates,
  getCurrentVersion,
} from "../src/lib/update-check";

// ── semverGt ──────────────────────────────────────────────
test("semverGt: patch bump is newer", () => {
  expect(semverGt("1.1.1", "1.1.0")).toBe(true);
});

test("semverGt: minor bump beats higher patch", () => {
  expect(semverGt("1.2.0", "1.1.9")).toBe(true);
});

test("semverGt: major bump beats everything below", () => {
  expect(semverGt("2.0.0", "1.9.9")).toBe(true);
});

test("semverGt: equal versions are not greater", () => {
  expect(semverGt("1.1.0", "1.1.0")).toBe(false);
});

test("semverGt: older is not greater", () => {
  expect(semverGt("1.0.0", "1.0.1")).toBe(false);
});

test("semverGt: multi-digit segments compare numerically not lexically", () => {
  expect(semverGt("1.10.0", "1.9.0")).toBe(true);
});

test("semverGt: missing segments default to 0", () => {
  expect(semverGt("1.1", "1.1.0")).toBe(false);
  expect(semverGt("1.1.1", "1.1")).toBe(true);
});

test("semverGt: non-numeric (prerelease) segment compares as equal — known limitation", () => {
  // "1.2.0-beta" → [1, 2, NaN]; NaN comparisons are false, so treated as equal.
  expect(semverGt("1.2.0-beta", "1.2.0")).toBe(false);
});

// ── checkForUpdates ───────────────────────────────────────
// Helper: write a cache file in a throwaway dir and return its path.
function withCache(contents: string): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "statusline-update-"));
  const file = join(dir, "update-check.json");
  writeFileSync(file, contents);
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const fresh = () => Math.floor(Date.now() / 1000); // within the 24h window

test("checkForUpdates: returns latest when a newer version is cached", () => {
  const { file, cleanup } = withCache(
    JSON.stringify({ lastCheck: fresh(), latestVersion: "2.0.0" }),
  );
  let spawned = 0;
  expect(checkForUpdates("1.0.0", file, () => spawned++)).toBe("2.0.0");
  expect(spawned).toBe(0); // fresh cache, no background check
  cleanup();
});

test("checkForUpdates: returns null when cached version equals current", () => {
  const { file, cleanup } = withCache(
    JSON.stringify({ lastCheck: fresh(), latestVersion: "1.1.1" }),
  );
  expect(checkForUpdates("1.1.1", file, () => {})).toBeNull();
  cleanup();
});

test("checkForUpdates: returns null when cached version is older than current", () => {
  const { file, cleanup } = withCache(
    JSON.stringify({ lastCheck: fresh(), latestVersion: "1.0.0" }),
  );
  expect(checkForUpdates("1.2.0", file, () => {})).toBeNull();
  cleanup();
});

test("checkForUpdates: stale cache (>24h) triggers a background check", () => {
  const stale = Math.floor(Date.now() / 1000) - 90000; // ~25h ago
  const { file, cleanup } = withCache(
    JSON.stringify({ lastCheck: stale, latestVersion: "2.0.0" }),
  );
  let spawnedWith = "";
  // Still returns the cached value this render, but kicks off a refresh.
  expect(checkForUpdates("1.0.0", file, (f) => (spawnedWith = f))).toBe("2.0.0");
  expect(spawnedWith).toBe(file);
  cleanup();
});

test("checkForUpdates: missing cache file returns null and triggers first check", () => {
  const missing = join(tmpdir(), "statusline-nonexistent", "update-check.json");
  let spawned = 0;
  expect(checkForUpdates("1.0.0", missing, () => spawned++)).toBeNull();
  expect(spawned).toBe(1);
});

test("checkForUpdates: malformed cache JSON returns null and triggers a check", () => {
  const { file, cleanup } = withCache("not valid json {");
  let spawned = 0;
  expect(checkForUpdates("1.0.0", file, () => spawned++)).toBeNull();
  expect(spawned).toBe(1);
  cleanup();
});

// ── getCurrentVersion ─────────────────────────────────────
test("getCurrentVersion: reads version from package.json", () => {
  const { file, cleanup } = withCache(JSON.stringify({ version: "3.4.5" }));
  expect(getCurrentVersion(file)).toBe("3.4.5");
  cleanup();
});

test("getCurrentVersion: falls back to 0.0.0 on missing file", () => {
  expect(getCurrentVersion(join(tmpdir(), "nope", "package.json"))).toBe(
    "0.0.0",
  );
});

# src/lib/

Data gathering and shared utilities. No rendering, no Svelte imports.

## data.ts
Gathers all statusline props from stdin JSON + system state. `gatherData()` is the single entry point.

- `getLocationData` - cwd → path (~ substitution), git branch + diff numstat. Cached 5s
- `getContextData` - model name (strip version suffix), context window percentage, cache write tokens (from transcript JSONL)
- `getUsageData` - reads `input.rate_limits` (five_hour/seven_day) straight from stdin JSON. Pure, synchronous, no network. Each window may be independently absent (only present for Pro/Max subscribers after first API response). Persists the latest snapshot to `usage.json` and falls back to it when input lacks rate_limits, so a new session shows the last-known limits before its first API response. Windows past their `resets_at` epoch are dropped (rolled over → stale pct)
- `getProcessData` - `ps aux` for claude PIDs, `pgrep` children for mcp/context7. Cached 10s
- `getTasksData` - reads `~/.claude/session-tasks/{sessionId}.json`
- `getPromptData` - reads last 16KB of transcript JSONL, finds last user message, strips noise patterns

Cache dir: `~/.claude/cache/statusline/` (git-data, processes-data, usage)

## theme.ts
- `theme` object: MUTABLE RGB tuples for all semantic colors (green, yellow, orange, red, model, label, etc.). Components import this binding and read it at render time; `applyTheme` mutates in place (never reassign)
- `applyTheme(name, overrides?)` - swaps the live palette to a preset from themes.ts (unknown name → default), then applies optional per-key `[r,g,b]` overrides (invalid ones skipped). Called from index.ts after config load, before render
- `toRgb()` converts tuple to `rgb(r,g,b)` string for nib-ink
- `thresholdRgb()` / `ctxRgb()` / `rateRgb()` - color scales based on percentage thresholds
- `formatTokensCompact()` - 51832 → `51k`, 1234567 → `1.2m`
- `countdownFromEpoch()` - epoch seconds → `2d 3h`, `1h 42m`, `23m`, `now`. `countdownFromIso()` wraps it for ISO strings
- File helpers: `readFileSafe`, `writeFileSafe`, `fileMtime`

## themes.ts
- `themeNames` / `ThemeName` - the 5 selectable themes: default, tokyo-night, dracula, gruvbox, nord
- `themes` - `Record<ThemeName, Record<key, RgbTuple>>`, each defining all 12 semantic keys. "default" is byte-identical to the original theme.ts palette
- User config (`~/.claude/.statusline/config.json`, bootstrapped by index.ts) picks the theme + supplies color overrides, applied via `applyTheme`

## Rate limits
Read from `input.rate_limits` (see `getUsageData` above), not fetched. The old `usage-fetch.ts` (OAuth → `api.anthropic.com/api/oauth/usage` with caching/locking/backoff) was removed once Claude Code began sending `rate_limits` in the stdin JSON.

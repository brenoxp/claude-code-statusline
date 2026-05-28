# src/lib/

Data gathering and shared utilities. No rendering, no Svelte imports.

## data.ts
Gathers all statusline props from stdin JSON + system state. `gatherData()` is the single entry point.

- `getLocationData` - cwd → path (~ substitution), git branch + diff numstat. Cached 5s
- `getContextData` - model name (strip version suffix), context window percentage, cache write tokens (from transcript JSONL)
- `getUsageData` - reads `input.rate_limits` (five_hour/seven_day) straight from stdin JSON. Pure, synchronous, no network. Each window may be independently absent (only present for Pro/Max subscribers after first API response)
- `getProcessData` - `ps aux` for claude PIDs, `pgrep` children for mcp/context7. Cached 10s
- `getTasksData` - reads `~/.claude/session-tasks/{sessionId}.json`
- `getPromptData` - reads last 16KB of transcript JSONL, finds last user message, strips noise patterns

Cache dir: `~/.claude/cache/statusline/` (git-data, processes-data, usage)

## theme.ts
- `theme` object: RGB tuples for all semantic colors (green, yellow, orange, red, model, label, etc.)
- `toRgb()` converts tuple to `rgb(r,g,b)` string for nib-ink
- `thresholdRgb()` / `ctxRgb()` / `rateRgb()` - color scales based on percentage thresholds
- `formatTokensCompact()` - 51832 → `51k`, 1234567 → `1.2m`
- `countdownFromEpoch()` - epoch seconds → `2d 3h`, `1h 42m`, `23m`, `now`. `countdownFromIso()` wraps it for ISO strings
- File helpers: `readFileSafe`, `writeFileSafe`, `fileMtime`

## Rate limits
Read from `input.rate_limits` (see `getUsageData` above), not fetched. The old `usage-fetch.ts` (OAuth → `api.anthropic.com/api/oauth/usage` with caching/locking/backoff) was removed once Claude Code began sending `rate_limits` in the stdin JSON.

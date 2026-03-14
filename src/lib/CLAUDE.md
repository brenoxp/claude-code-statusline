# src/lib/

Data gathering and shared utilities. No rendering, no Svelte imports.

## data.ts
Gathers all statusline props from stdin JSON + system state. `gatherData()` is the single entry point.

- `getLocationData` - cwd → path (~ substitution), git branch + diff numstat. Cached 5s
- `getContextData` - model name (strip version suffix), context window percentage, cache write tokens (from transcript JSONL)
- `getUsageData` - reads cached usage.json, spawns background refresh via `--fetch-usage` flag on self. First call is synchronous
- `getProcessData` - `ps aux` for claude PIDs, `pgrep` children for mcp/context7. Cached 10s
- `getTasksData` - reads `~/.claude/session-tasks/{sessionId}.json`
- `getPromptData` - reads last 16KB of transcript JSONL, finds last user message, strips noise patterns

Cache dir: `~/.claude/cache/statusline/` (git-data, processes-data, usage)

## theme.ts
- `theme` object: RGB tuples for all semantic colors (green, yellow, orange, red, model, label, etc.)
- `toRgb()` converts tuple to `rgb(r,g,b)` string for nib-ink
- `thresholdRgb()` / `ctxRgb()` / `rateRgb()` - color scales based on percentage thresholds
- `formatTokensCompact()` - 51832 → `51k`, 1234567 → `1.2m`
- `countdownFromIso()` - ISO timestamp → `2d 3h`, `1h 42m`, `23m`, `now`
- File helpers: `readFileSafe`, `writeFileSafe`, `fileMtime`

## usage-fetch.ts
Fetches rate limits from `api.anthropic.com/api/oauth/usage`. Self-contained with locking, backoff, caching.

- OAuth token resolution: env var → macOS keychain (`security`) → `~/.claude/.credentials.json`
- 60s cache TTL, 5min backoff on failure, file-based lock (pid file)
- Detects 5-hour window resets (usage drop > 5%) and logs to `~/.claude/logs/usage-windows.log`
- Can run standalone via `--fetch-usage` arg (used by data.ts for background spawns)

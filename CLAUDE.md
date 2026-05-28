# claude-code-statusline

Custom statusline for Claude Code CLI. Built with nib-ink (Svelte 5), renders ANSI output with session info (path, git, model, context, rate limits, processes, tasks, prompt).

## Structure
- `src/index.ts` - entry point (stdin → renderToString → stdout)
- `src/components/` - Svelte 5 components
- `src/lib/` - data gathering, theme
- `build.ts` - esbuild config
- `settings.json` - runtime config
- `examples/` - sample inputs + SVG
- `scripts/generate-example-svg.ts` - ANSI-to-SVG for README

## Build
```bash
bun run build    # → dist/index.js (single bundle, zero runtime deps)
bun run test     # build, truncation, integration, sanitization + bun unit tests (update-check)
```

## Key design decisions
- macOS only (BSD `ps`/`pgrep`/`stty` flags for process detection + terminal sizing)
- Terminal width: `COLUMNS` env (CC injects it for status line scripts) > `process.stdout.columns` > walk parent PIDs for tty > 80
- Panel padding: < 80 cols = 4, >= 80 cols = 5. Lines space-padded to full termWidth
- esbuild resolves svelte to `index-client.js` via `conditions: ["browser"]` + svelteDedup plugin. No `--conditions=browser` needed at runtime

## Claude Code statusline internals (from binary reverse-engineering)

Claude Code's TUI is built with Ink (React for terminals, uses Yoga layout). The status area at the bottom is an Ink flexbox:

```
<Box flexDirection={cols < 80 ? "column" : "row"} justifyContent="space-between" paddingX={2} gap={cols < 80 ? 0 : 1}>
  <Box flexDirection="column" flexShrink={cols < 80 ? 0 : 1}>
    <!-- our statusline output -->
  </Box>
  <Box flexShrink={1} gap={1}>
    <!-- model indicator, context %, effort level -->
  </Box>
</Box>
```

- Our output is wrapped in `<Text dimColor wrap="truncate">`, ANSI is parsed and decomposed into Ink `<Text>` elements
- Width measured via `Bun.stringWidth` (ANSI-aware), truncation is ANSI-safe (uses slice-ansi)
- Width collision: if our lines + right-side indicators > available width, Yoga squeezes both. Use `maxLineWidth` in settings.json to prevent

## Settings
User config lives at `~/.claude/.statusline/config.json` (bootstrapped on first run alongside a pre-computed `CLAUDE.md`). Precedence: packaged `settings.json` defaults < user config < env vars. Same fields as below plus:
- `theme` ("default") - one of: default, tokyo-night, dracula, gruvbox, nord (see `src/lib/themes.ts`)
- `colors` ({}) - per-key RGB overrides on top of theme, e.g. `{ "green": [70,195,115] }`. 12 keys: green, yellow, orange, red, model, label, slate, purple, muted, prompt, barDim, barLerp

Packaged `settings.json` (dev/legacy fallback, runtime config, env overrides):
- `maxLineWidth` (70) - cap line width
- `cacheWrite` (true) - show cache_creation_input_tokens (✎ indicator)
- `minPromptLineWidth` (40) - minimum prompt line width
- `debug` (false) - timing to stderr. Env: `STATUSLINE_DEBUG`
- `testMode` (false) - read from examples/. Env: `TEST_MODE`
- `log` (false) - save stdin JSON to logs/. Env: `STATUSLINE_LOG`

## Repo
- GitHub: github.com/brenoxp/claude-code-statusline

@docs/index.md

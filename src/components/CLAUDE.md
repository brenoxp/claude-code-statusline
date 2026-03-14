# src/components/

Svelte 5 components rendered via nib-ink's `renderToString`. No browser DOM, no SSR, client-mode only.

## Component hierarchy
- `Statusline` - root, sets `width={maxWidth}`, composes all others
- `Location` - path (bold, truncate-middle 0.25), branch (truncate), +additions/-deletions
- `ContextBar` - model name (bold, 8-char box), progress bar, percentage (inverse at 80%+), token count, cache write
- `ProgressBar` - gradient fill: solid dots → fractional lerp dot → dim empty dots. 10 dots, space-separated
- `UsageLimits` - session (inverse at 90%+) and weekly bars with countdown. Label in 8-char box
- `Processes` - CLI count (purple bold), MCP count (slate dim)
- `Tasks` - completed (slate dim ✓) and current (muted →), truncatable
- `Prompt` - last user prompt (❯ prefix, truncate), voice prefix `[voice]`

## Layout patterns
- Fixed-width elements: `<Box flexShrink={0}>` or `<Box width={8}>`
- Truncatable text: `<Box flexShrink={1}>` + `<Text wrap="truncate">`
- All rows use `<Box flexDirection="row" gap={2}>` (gap=1 for tasks/prompt)
- Labels (session/weekly) use `<Box width={8}>` for column alignment

## Theme colors
All colors come from `../lib/theme.ts` as RGB tuples, converted via `toRgb()`. Never use raw color strings.

## nib-ink quirks
- `dimColor` prop dims the color (not the text opacity)
- `inverse` swaps fg/bg, used for high-usage warnings
- `truncatePosition={0.25}` on Location keeps 25% head + 75% tail when truncating paths
- `bold` on Text works, renders ANSI bold escape

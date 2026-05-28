# How it works

Claude Code runs your script and pipes JSON session data to it via stdin. Your script reads the JSON, extracts what it needs, and prints text to stdout. Claude Code displays whatever your script prints.

## Update triggers

Your script runs after:

- each new assistant message
- `/compact` finishes
- permission mode changes
- vim mode toggles

Updates are debounced at 300ms — rapid changes batch together and the script runs once things settle. If a new update triggers while the script is still running, the in-flight execution is cancelled.

If you edit your script, changes won't appear until the next interaction triggers an update.

These triggers go quiet when the main session is idle (e.g., while a coordinator waits on background subagents). Set `refreshInterval` to keep time-based or externally-sourced segments current during idle periods.

## What your script can output

- **Multiple lines** — each `echo`/`print` displays as a separate row
- **Colors** — ANSI escape codes like `\033[32m` for green (requires terminal support)
- **Links** — OSC 8 escape sequences for clickable text (Cmd+click on macOS, Ctrl+click on Windows/Linux). Requires iTerm2, Kitty, or WezTerm.

## Terminal size

Claude Code captures your script's output instead of connecting it directly to the terminal, so `tput cols` and language-level width detection can't read terminal size from inside the script.

Read the `COLUMNS` and `LINES` environment variables instead. Claude Code sets these to the current terminal dimensions before running your script. Requires Claude Code v2.1.153+.

## Notes

- The status line runs locally and does not consume API tokens.
- It temporarily hides during autocomplete suggestions, the help menu, and permission prompts.
- Requires workspace trust acceptance. If not accepted, you'll see `statusline skipped · restart to fix`. Restart Claude Code and accept the trust prompt.
- If `disableAllHooks` is `true` in settings, the status line is also disabled.

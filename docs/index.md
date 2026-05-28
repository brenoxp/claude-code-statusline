# Status line documentation

Reference docs for the Claude Code custom status line feature.

These docs are current with the official Claude Code documentation (verified 2026-05-28, against CC v2.1.132). Use them as the source of truth, no need to fetch external documentation.

## Contents

- [overview.md](content/overview.md) — what the status line is, when it's useful, quick start
- [setup.md](content/setup.md) — `/statusline` command, manual config, options, step-by-step walkthrough, Windows
- [how-it-works.md](content/how-it-works.md) — update triggers, output capabilities, terminal sizing
- [available-data.md](content/available-data.md) — full JSON field reference, schema, context window fields
- [examples.md](content/examples.md) — ready-to-use scripts in Bash, Python, and Node.js
  - context window usage with progress bar
  - git status with colors
  - cost and duration tracking
  - multi-line display
  - clickable links (OSC 8)
  - rate limit usage
  - caching expensive operations
- [subagent-status-lines.md](content/subagent-status-lines.md) — `subagentStatusLine` setting for the agent panel
- [troubleshooting.md](content/troubleshooting.md) — tips and common issues

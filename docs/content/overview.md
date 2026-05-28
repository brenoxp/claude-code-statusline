# Overview

The status line is a customizable bar at the bottom of Claude Code that runs any shell script you configure. It receives JSON session data on stdin and displays whatever your script prints, giving you a persistent, at-a-glance view of context usage, costs, git status, or anything else you want to track.

Useful when you:

- want to monitor context window usage as you work
- need to track session costs
- work across multiple sessions and need to distinguish them
- want git branch and status always visible

## Quick start

Use the `/statusline` command with natural language:

```
/statusline show model name and context percentage with a progress bar
```

Claude Code generates a script in `~/.claude/` and updates your settings automatically.

For manual setup, add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

The script receives JSON on stdin, prints to stdout. Claude Code displays whatever it prints.

See [setup.md](setup.md) for full configuration options, [how-it-works.md](how-it-works.md) for data flow details, and [examples.md](examples.md) for ready-to-use scripts.

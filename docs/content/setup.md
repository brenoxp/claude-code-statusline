# Setup

## /statusline command

The `/statusline` command accepts natural language. Claude Code generates a script in `~/.claude/` and updates your settings automatically:

```
/statusline show model name and context percentage with a progress bar
```

## Manual configuration

Add a `statusLine` field to `~/.claude/settings.json` (user-level) or `.claude/settings.json` (project-level):

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2
  }
}
```

The `command` field runs in a shell. You can use an inline command instead of a script file:

```json
{
  "statusLine": {
    "type": "command",
    "command": "jq -r '\"[\\(.model.display_name)] \\(.context_window.used_percentage // 0)% context\"'"
  }
}
```

### Options

- `padding` — extra horizontal spacing in characters added to status line content (in addition to the interface's built-in spacing). Defaults to `0`.
- `refreshInterval` — re-runs the command every N seconds in addition to event-driven updates. Minimum: `1`. Use for time-based data (clocks) or when background subagents change git state while the main session is idle. Omit to run only on events.
- `hideVimModeIndicator` — set to `true` to suppress the built-in `-- INSERT --` text when your script renders `vim.mode` itself.

## Step-by-step walkthrough

### 1. Create the script

Save to `~/.claude/statusline.sh`:

```bash
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

echo "[$MODEL] 📁 ${DIR##*/} | ${PCT}% context"
```

### 2. Make it executable

```bash
chmod +x ~/.claude/statusline.sh
```

### 3. Add to settings

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

Settings reload automatically, but changes won't appear until your next interaction with Claude Code.

## Disable

Run `/statusline delete` (or `clear`, `remove it`), or delete the `statusLine` field from `settings.json`.

## Windows configuration

On Windows, Claude Code routes commands through Git Bash when installed, or PowerShell when not. Use forward slashes in paths — backslashes are consumed as escape characters before the script runner sees them.

To run a PowerShell script:

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -File C:/Users/username/.claude/statusline.ps1"
  }
}
```

```powershell
$input_json = $input | Out-String | ConvertFrom-Json
$cwd = $input_json.cwd
$model = $input_json.model.display_name
$used = $input_json.context_window.used_percentage
$dirname = Split-Path $cwd -Leaf

if ($used) {
    Write-Host "$dirname [$model] ctx: $used%"
} else {
    Write-Host "$dirname [$model]"
}
```

Or with Git Bash:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

```bash
#!/usr/bin/env bash
input=$(cat)
cwd=$(echo "$input" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
model=$(echo "$input" | grep -o '"display_name":"[^"]*"' | cut -d'"' -f4)
dirname="${cwd##*[/\\]}"
echo "$dirname [$model]"
```

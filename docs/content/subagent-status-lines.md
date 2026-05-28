# Subagent status lines

The `subagentStatusLine` setting renders a custom row body for each subagent shown in the agent panel below the prompt. Use it to replace the default `name · description · token count` row with your own formatting.

```json
{
  "subagentStatusLine": {
    "type": "command",
    "command": "~/.claude/subagent-statusline.sh"
  }
}
```

## Input

The command runs once per refresh tick with all visible subagent rows passed as a single JSON object on stdin. The input includes the base hook fields plus:

- `columns` — usable row width
- `tasks` array — each task has: `id`, `name`, `type`, `status`, `description`, `label`, `startTime`, `tokenCount`, `tokenSamples`, `cwd`

## Output

Write one JSON line to stdout per row you want to override:

```json
{"id": "<task id>", "content": "<row body>"}
```

- `content` renders as-is, including ANSI colors and OSC 8 hyperlinks
- Omit a task's `id` to keep the default rendering for that row
- Emit an empty `content` string to hide the row

## Notes

- The same trust and `disableAllHooks` gates that apply to `statusLine` apply here.
- Plugins can ship a default `subagentStatusLine` in their `settings.json`.

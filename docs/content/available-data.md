# Available data

Claude Code sends the following JSON fields to your script via stdin.

## Fields

| Field | Description |
| --- | --- |
| `model.id`, `model.display_name` | Current model identifier and display name |
| `cwd`, `workspace.current_dir` | Current working directory. Both contain the same value; `workspace.current_dir` is preferred. |
| `workspace.project_dir` | Directory where Claude Code was launched (may differ from `cwd` if the working directory changes) |
| `workspace.added_dirs` | Additional directories added via `/add-dir` or `--add-dir`. Empty array if none. |
| `workspace.git_worktree` | Git worktree name when inside a linked worktree. Absent in the main working tree. |
| `workspace.repo.host`, `workspace.repo.owner`, `workspace.repo.name` | Repository identity parsed from the `origin` remote. Absent outside a git repo or without an `origin` remote. |
| `cost.total_cost_usd` | Estimated session cost in USD (client-side, may differ from actual bill) |
| `cost.total_duration_ms` | Total wall-clock time since session started, in ms |
| `cost.total_api_duration_ms` | Total time spent waiting for API responses, in ms |
| `cost.total_lines_added`, `cost.total_lines_removed` | Lines of code changed |
| `context_window.total_input_tokens`, `context_window.total_output_tokens` | Token counts currently in the context window (from the most recent API response). Before v2.1.132 these were cumulative session totals. |
| `context_window.context_window_size` | Maximum context window size in tokens (200000 by default, 1000000 for extended context models) |
| `context_window.used_percentage` | Pre-calculated percentage of context window used |
| `context_window.remaining_percentage` | Pre-calculated percentage of context window remaining |
| `context_window.current_usage` | Token counts from last API call broken out by category (see below) |
| `exceeds_200k_tokens` | Whether total tokens from the most recent API response exceed 200k (fixed threshold) |
| `effort.level` | Current reasoning effort: `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`. Absent when model doesn't support it. |
| `thinking.enabled` | Whether extended thinking is enabled |
| `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage` | Percentage of 5-hour or 7-day rate limit consumed (0–100) |
| `rate_limits.five_hour.resets_at`, `rate_limits.seven_day.resets_at` | Unix epoch seconds when the rate limit window resets |
| `session_id` | Unique session identifier |
| `session_name` | Custom session name (set with `--name` or `/rename`). Absent if not set. |
| `transcript_path` | Path to the conversation transcript file |
| `version` | Claude Code version |
| `output_style.name` | Name of the current output style |
| `vim.mode` | Current vim mode: `NORMAL`, `INSERT`, `VISUAL`, or `VISUAL LINE`. Absent when vim mode is disabled. |
| `agent.name` | Agent name when running with `--agent` flag. Absent otherwise. |
| `pr.number`, `pr.url` | Open PR for the current branch. Absent until found, removed when PR merges/closes. |
| `pr.review_state` | Review status: `approved`, `pending`, `changes_requested`, or `draft`. May be absent even when `pr` is present. |
| `worktree.name` | Active worktree name. Present only during `--worktree` sessions. |
| `worktree.path` | Absolute path to the worktree directory |
| `worktree.branch` | Git branch name for the worktree. Absent for hook-based worktrees. |
| `worktree.original_cwd` | Directory Claude was in before entering the worktree |
| `worktree.original_branch` | Git branch checked out before entering the worktree. Absent for hook-based worktrees. |

## Fields that may be absent

- `session_name` — only when set via `--name` or `/rename`
- `workspace.git_worktree` — only inside a linked git worktree
- `workspace.repo` — only inside a git repo with an `origin` remote
- `effort` — only when current model supports reasoning effort
- `vim` — only when vim mode is enabled
- `agent` — only when running with `--agent` flag
- `pr` — only while an open PR is found; removed once PR merges or closes
- `worktree` — only during `--worktree` sessions
- `rate_limits` — only for Claude.ai subscribers (Pro/Max) after the first API response. Each window may be independently absent.

## Fields that may be null

- `context_window.current_usage` — null before the first API call and again after `/compact`
- `context_window.used_percentage`, `context_window.remaining_percentage` — may be null early in the session

## context_window fields

`current_usage` contains:

- `input_tokens` — input tokens in current context
- `output_tokens` — output tokens generated
- `cache_creation_input_tokens` — tokens written to cache
- `cache_read_input_tokens` — tokens read from cache

`total_input_tokens` = `input_tokens` + `cache_creation_input_tokens` + `cache_read_input_tokens`

`used_percentage` is calculated from input tokens only (not output tokens). If you calculate it manually, use the same formula to match the field value.

## Full JSON schema

```json
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "session_name": "my-session",
  "transcript_path": "/path/to/transcript.jsonl",
  "model": {
    "id": "claude-opus-4-8",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory",
    "added_dirs": [],
    "git_worktree": "feature-xyz",
    "repo": {
      "host": "github.com",
      "owner": "anthropics",
      "name": "claude-code"
    }
  },
  "version": "2.1.90",
  "output_style": {
    "name": "default"
  },
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15500,
    "total_output_tokens": 1200,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false,
  "effort": {
    "level": "high"
  },
  "thinking": {
    "enabled": true
  },
  "rate_limits": {
    "five_hour": {
      "used_percentage": 23.5,
      "resets_at": 1738425600
    },
    "seven_day": {
      "used_percentage": 41.2,
      "resets_at": 1738857600
    }
  },
  "vim": {
    "mode": "NORMAL"
  },
  "agent": {
    "name": "security-reviewer"
  },
  "pr": {
    "number": 1234,
    "url": "https://github.com/anthropics/claude-code/pull/1234",
    "review_state": "pending"
  },
  "worktree": {
    "name": "my-feature",
    "path": "/path/to/.claude/worktrees/my-feature",
    "branch": "worktree-my-feature",
    "original_cwd": "/path/to/project",
    "original_branch": "main"
  }
}
```

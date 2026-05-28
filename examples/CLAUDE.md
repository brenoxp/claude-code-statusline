# examples/

Sample inputs and visual output for testing and documentation.

## Input JSON format (stdin from Claude Code)
Full field reference: `docs/content/available-data.md`. Fields the statusline currently reads:

- `session_id` - UUID, used to find session tasks
- `transcript_path` - path to session JSONL (for prompt extraction + cache write tokens)
- `cwd` - working directory
- `model.id`, `model.display_name` - active model
- `context_window.context_window_size` - max tokens (e.g. 200000)
- `context_window.current_usage` - `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`

Other fields Claude Code now sends (carried in `input_with_context.json` for reference/future use, not consumed by the renderer): `session_name`, `workspace.added_dirs/git_worktree/repo`, `version`, `output_style`, `cost`, `context_window.used_percentage/remaining_percentage`, `exceeds_200k_tokens`, `effort.level`, `thinking.enabled`, `rate_limits.{five_hour,seven_day}`, `vim.mode`, `agent.name`, `pr.{number,url,review_state}`, `worktree.{name,path,branch,original_cwd,original_branch}`. Note: rate-limit display comes from a separate keychain/API fetch, not the `rate_limits` input field.

## Files
- `input.json` - minimal input (no context window data)
- `input_with_context.json` - full input: context window usage plus every field Claude Code currently sends (testMode reads this)
- `statusline.svg` - rendered SVG screenshot for README (regenerate: `bun scripts/generate-example-svg.ts`)

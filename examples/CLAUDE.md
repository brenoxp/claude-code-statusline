# examples/

Sample inputs and visual output for testing and documentation.

## Input JSON format (stdin from Claude Code)
These fields are what Claude Code passes to the statusline command via stdin:

- `session_id` - UUID, used to find session tasks
- `transcript_path` - path to session JSONL (for prompt extraction + cache write tokens)
- `cwd` - working directory
- `model.id`, `model.display_name` - active model
- `context_window.context_window_size` - max tokens (e.g. 200000)
- `context_window.current_usage` - `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
- `version` - Claude Code version
- `cost` - session cost/duration stats (not displayed)

## Files
- `input.json` - minimal input (no context window data)
- `input_with_context.json` - full input with context window usage
- `statusline.svg` - rendered SVG screenshot for README (regenerate: `bun scripts/generate-example-svg.ts`)

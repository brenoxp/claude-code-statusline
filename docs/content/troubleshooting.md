# Tips and troubleshooting

## Tips

- **Test with mock input**: `echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/home/user/project"},"context_window":{"used_percentage":25},"session_id":"test-session-abc"}' | ./statusline.sh`
- **Keep output short**: the status bar has limited width; long output may get truncated or wrap.
- **Cache slow operations**: your script runs frequently. Commands like `git status` can cause lag in large repos. See the [caching example](examples.md#cache-expensive-operations).
- Community projects: [ccstatusline](https://github.com/sirmalloc/ccstatusline) and [starship-claude](https://github.com/martinemde/starship-claude) provide pre-built configurations.

## Status line not appearing

- Verify the script is executable: `chmod +x ~/.claude/statusline.sh`
- Check that the script outputs to stdout, not stderr
- Run the script manually with mock input to verify it produces output
- On Windows with Git Bash: backslashes in `command` path are consumed as escape characters. Use forward slashes.
- If `disableAllHooks` is `true` in settings, the status line is also disabled.
- Run `claude --debug` to log the exit code and stderr from the first status line invocation.
- Ask Claude to read your settings file and execute the `statusLine` command directly to surface errors.

## Status line shows `--` or empty values

- Fields may be null before the first API response completes.
- Handle null values with fallbacks like `// 0` in jq.
- Restart Claude Code if values remain empty after multiple messages.

## Context percentage shows unexpected values

- Use `used_percentage` for the simplest accurate context state.
- Context percentage may differ from `/context` output due to when each is calculated.

## OSC 8 links not clickable

- iTerm2, Kitty, and WezTerm support OSC 8. Terminal.app does not.
- If link text appears but isn't clickable, Claude Code may not have detected hyperlink support. Set `FORCE_HYPERLINK=1` before launching: `FORCE_HYPERLINK=1 claude`
- In PowerShell: `$env:FORCE_HYPERLINK = "1"; claude`
- SSH and tmux sessions may strip OSC sequences depending on configuration.
- If escape sequences appear as literal text like `\e]8;;`, use `printf '%b'` instead of `echo -e`.

## Display glitches with escape sequences

- Complex escape sequences can cause garbled output if they overlap with other UI updates.
- Try simplifying to plain text output to isolate the issue.
- Multi-line status lines with escape codes are more prone to rendering issues than single-line plain text.

## Workspace trust required

The status line command only runs if you've accepted the workspace trust dialog for the current directory. If trust isn't accepted, you'll see `statusline skipped · restart to fix`. Restart Claude Code and accept the trust prompt.

## Script errors or hangs

- Scripts that exit with non-zero codes or produce no output cause the status line to go blank.
- Slow scripts block updates until they complete. Keep scripts fast.
- If a new update triggers while a slow script is running, the in-flight script is cancelled.
- Test independently with mock input before configuring.

## Notifications share the status line row

System notifications (MCP errors, auto-updates) display on the right side of the same row. Transient notifications like the context-low warning also cycle through this area. Verbose mode adds a token counter. On narrow terminals, these may truncate your status line output.

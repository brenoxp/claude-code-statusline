# Plan: statusline plugin self-distribution (no npm)

## Goal

Make the `statusline` plugin in the `plugins-breno` marketplace ship its own
built bundle so installing the plugin gives a working status line with **no npm
dependency**. The `/statusline:config` skill copies the bundle to a stable path
(`~/.claude/.statusline/bin/`) and points Claude Code's `statusLine.command` at
it. Stable path survives plugin version bumps (the cache dir is version-stamped,
e.g. `.../statusline/0.2.0/`, so we must NOT point settings into the cache).

This is "option 1" from the design discussion: commit `dist/` into the plugin,
config skill copies it out to a fixed location.

## Context for the implementer

You know almost nothing about this codebase. Read this section fully.

- Two separate git repos are involved:
  - **statusline repo**: `~/apps/claude-code/statusline` (public, npm package
    `@brenoxp/cc-statusline`). Source + build live here. `dist/index.js` is a
    single self-contained ESM bundle with a `#!/usr/bin/env node` shebang and
    zero runtime deps (built via `bun run build`). It runs under `bun` or `node`.
  - **claude-userland repo**: `~/.claude/claude-userland` (private). The
    marketplace lives at `plugins-breno/`. The statusline PLUGIN source is at
    `plugins-breno/plugins/statusline/`. This is symlinked into `~/.claude`.
- The marketplace is currently a `directory` source (local), installed plugin
  cache at `~/.claude/plugins/cache/plugins-breno/statusline/<version>/`.
- `${CLAUDE_PLUGIN_ROOT}` MAY or MAY NOT be set in the skill's bash at runtime.
  Do not rely on it alone — always provide the glob fallback shown in Task 3.
- The existing launcher `~/apps/claude-code/statusline/bin/cc-statusline`
  already encodes the `bun || node` fallback. We mirror a flat-layout variant.
- Runtime config dir `~/.claude/.statusline/` already exists in the design
  (holds `config.json` + auto-generated `CLAUDE.md`). We add a `bin/` subdir.

## File structure (what changes)

In **claude-userland** (`plugins-breno/`):
- `plugins/statusline/dist/index.js` — NEW, committed copy of the built bundle.
- `plugins/statusline/bin/cc-statusline` — NEW, flat-layout launcher script.
- `plugins/statusline/.claude-plugin/plugin.json` — ADD `version` field.
- `plugins/statusline/skills/config/SKILL.md` — REWRITE steps 1-3 (drop npm,
  add copy-to-stable-path + new settings wiring).
- `.claude-plugin/marketplace.json` — bump statusline entry `version`.

In **statusline repo** (`~/apps/claude-code/statusline`):
- `.claude/commands/deploy.md` — ADD a cross-repo sync step (copy `dist` into
  the plugin, bump plugin versions, commit in claude-userland).

Resulting runtime layout on a user machine:
- `~/.claude/.statusline/bin/index.js` — copied bundle
- `~/.claude/.statusline/bin/cc-statusline` — launcher (chmod +x)
- `~/.claude/settings.json` → `statusLine.command` = absolute path to launcher

## Conventions

- Use `$HOME`, never literal `~` or `/Users/...`, in all scripts and skill text.
- Commit after each task. Commit message style: terse, `<summary>`, sacrifice
  grammar for concision (match existing history).
- claude-userland and statusline are separate repos — commit in the right one.

---

## Task 1: add the committed bundle + launcher to the plugin

Files: claude-userland `plugins-breno/plugins/statusline/`

Step 1 — build a fresh bundle in the statusline repo:
```
cd ~/apps/claude-code/statusline && bun run build
```
Expect: `dist/index.js` regenerated, exit 0.

Step 2 — copy the bundle into the plugin:
```
mkdir -p ~/.claude/claude-userland/plugins-breno/plugins/statusline/dist
cp ~/apps/claude-code/statusline/dist/index.js \
   ~/.claude/claude-userland/plugins-breno/plugins/statusline/dist/index.js
```

Step 3 — create the flat-layout launcher
`plugins-breno/plugins/statusline/bin/cc-statusline` with EXACTLY this content:
```sh
#!/bin/sh
# cc-statusline launcher (plugin-installed copy).
# Prefers bun (correct unicode width), falls back to node.
# The bundle sits next to this script.
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$(command -v bun || command -v node)" -- "$DIR/index.js" "$@"
```

Step 4 — make it executable:
```
chmod +x ~/.claude/claude-userland/plugins-breno/plugins/statusline/bin/cc-statusline
```

Step 5 — sanity check the launcher runs against a sample input:
```
cat ~/apps/claude-code/statusline/examples/*.json | head -1 | \
  ~/.claude/claude-userland/plugins-breno/plugins/statusline/bin/cc-statusline
```
Expect: non-empty ANSI output, exit 0. If `examples/` has no single-line JSON,
use any example file via stdin redirection instead. On failure: check the
bundle copied correctly and a runtime (bun/node) is on PATH.

Step 6 — commit in claude-userland:
```
cd ~/.claude/claude-userland && git add plugins-breno/plugins/statusline/dist plugins-breno/plugins/statusline/bin && git commit -m "statusline plugin: ship built bundle + launcher"
```

## Task 2: version the plugin manifest

File: `plugins-breno/plugins/statusline/.claude-plugin/plugin.json`

The manifest currently has no `version`. Add one so the cache dir is
deterministic. New content:
```json
{
  "name": "statusline",
  "version": "0.2.0",
  "description": "Self-contained cc-statusline custom Claude Code status line (themes, colors). Ships its own bundle — no npm required."
}
```
Commit:
```
cd ~/.claude/claude-userland && git add plugins-breno/plugins/statusline/.claude-plugin/plugin.json && git commit -m "statusline plugin: add version, update description"
```

## Task 3: rewrite the config skill (drop npm, copy to stable path)

File: `plugins-breno/plugins/statusline/skills/config/SKILL.md`

Rewrite Step 0 prose, Step 1 (prereqs), Step 2 (install), Step 3 (wire) as
below. Steps 4-6 (theme pick, config.json write, done message) stay as they are
today — do not touch them except where noted.

Replace Step 0's last sentence's npm framing. New Step 0 prose:
> `cc-statusline` is a custom Claude Code status line... [keep existing
> description] ... It ships as part of this plugin — no separate install, no
> npm. Configuring it copies a small self-contained bundle into
> `~/.claude/.statusline/bin/` and points Claude Code at it.

Replace Step 1 (prerequisites) with:
```
## Step 1: detect prerequisites
- macOS only: BSD `ps`/`stty` flags for process detection + terminal sizing.
  If `uname -s` is not `Darwin`, warn it may not work and ask whether to continue.
- A JS runtime is required. Check `command -v bun || command -v node`. If
  NEITHER is present, tell the user to install Node.js (or bun) first, then stop.
  bun is preferred (correct unicode width) but node works.
```

Replace Step 2 (install the binary) with:
```
## Step 2: install the bundle to a stable path
The plugin ships a self-contained bundle. Copy it (and its launcher) to a fixed
location that survives plugin updates. Do NOT point settings into the plugin
cache dir — it is version-stamped and moves on every bump.

Resolve the plugin dir (env var if set, else newest cached version):
```
PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT:-$(ls -d "$HOME"/.claude/plugins/cache/plugins-breno/statusline/*/ 2>/dev/null | sort -V | tail -1)}"
test -f "$PLUGIN_DIR/dist/index.js" || { echo "bundle not found under $PLUGIN_DIR"; exit 1; }

mkdir -p "$HOME/.claude/.statusline/bin"
cp "$PLUGIN_DIR/dist/index.js"     "$HOME/.claude/.statusline/bin/index.js"
cp "$PLUGIN_DIR/bin/cc-statusline" "$HOME/.claude/.statusline/bin/cc-statusline"
chmod +x "$HOME/.claude/.statusline/bin/cc-statusline"
```
Confirm it runs (pipe a sample event in):
```
echo '{}' | "$HOME/.claude/.statusline/bin/cc-statusline" >/dev/null && echo "bundle OK"
```
If that errors, surface the message and stop.
```

Replace Step 3 (wire it into Claude Code) with:
```
## Step 3: wire it into Claude Code
Point `statusLine.command` at the launcher. MERGE without clobbering other keys.
The command is written as a resolved absolute path (machine-generated config).

```
BIN="$HOME/.claude/.statusline/bin/cc-statusline"
if [ -f "$HOME/.claude/settings.json" ]; then
  tmp=$(mktemp)
  jq --arg c "$BIN" '.statusLine = {"type":"command","command":$c}' "$HOME/.claude/settings.json" > "$tmp" && mv "$tmp" "$HOME/.claude/settings.json"
else
  mkdir -p "$HOME/.claude"
  jq -n --arg c "$BIN" '{statusLine:{type:"command",command:$c}}' > "$HOME/.claude/settings.json"
fi
```
Show the user the resulting `statusLine` block to confirm.
```

In Step 6 (done message), update the re-run note to mention that re-running
`/statusline:config` also refreshes the bundle after a plugin update:
> Re-run `/statusline:config` any time to change the theme OR to refresh the
> bundle after updating the plugin.

Commit:
```
cd ~/.claude/claude-userland && git add plugins-breno/plugins/statusline/skills/config/SKILL.md && git commit -m "statusline:config skill: install bundled binary to stable path, drop npm"
```

## Task 4: bump the marketplace entry version

File: `plugins-breno/.claude-plugin/marketplace.json`

Find the `statusline` entry (currently `"version": "0.1.0"`). Bump to `0.2.0` to
match plugin.json. Leave its `source` (`./plugins/statusline`) unchanged.
Optionally update its `description` to drop the "cc-statusline" npm framing and
say "self-contained". Commit:
```
cd ~/.claude/claude-userland && git add plugins-breno/.claude-plugin/marketplace.json && git commit -m "marketplace: bump statusline 0.2.0 (self-contained bundle)"
```

## Task 5: keep the bundle in sync on release (deploy command)

File: `~/apps/claude-code/statusline/.claude/commands/deploy.md` (statusline repo)

The plugin's committed bundle must be refreshed whenever a new statusline
version is built. Add a sync step to the deploy command so it never drifts.

After the existing step 2 (`bun run build && bun run test`) and before pushing,
add a new numbered step (renumber following steps):

> N. Sync the built bundle into the plugin marketplace so the plugin ships the
>    same code that was just published:
>    - Copy `dist/index.js` →
>      `$HOME/.claude/claude-userland/plugins-breno/plugins/statusline/dist/index.js`
>    - Bump the `version` in BOTH
>      `plugins-breno/plugins/statusline/.claude-plugin/plugin.json` and the
>      statusline entry in `plugins-breno/.claude-plugin/marketplace.json`
>      (use the same bump type as the npm bump).
>    - In the claude-userland repo, commit: `git add plugins-breno/plugins/statusline && git commit -m "statusline plugin: sync bundle to v<newversion>"`.
>    - This is a SEPARATE repo from the statusline package — commit there too.

Commit in the statusline repo:
```
cd ~/apps/claude-code/statusline && git add .claude/commands/deploy.md && git commit -m "deploy: sync built bundle into plugins-breno on release"
```

## Task 6: end-to-end verification (fresh install simulation)

Use the `cc-eval` skill to spawn an isolated Claude session and run the real
flow, OR do it manually. Manual steps:

1. Reload plugins so the new plugin version is cached:
   tell Breno to run `/reload-plugins` (cannot be done programmatically), OR
   verify the cache picked up `0.2.0`:
   `ls ~/.claude/plugins/cache/plugins-breno/statusline/`.
2. Back up current settings: `cp ~/.claude/settings.json /tmp-not-allowed`...
   instead: note current `statusLine.command` value to restore after.
3. Run the config skill's Step 2 + Step 3 bash blocks by hand (or invoke
   `/statusline:config` and pick a theme).
4. Assert success criteria:
   - `jq .statusLine.command ~/.claude/settings.json` →
     `"<home>/.claude/.statusline/bin/cc-statusline"`
   - `test -x ~/.claude/.statusline/bin/cc-statusline` → exit 0
   - `echo '{}' | ~/.claude/.statusline/bin/cc-statusline` → non-empty, exit 0
   - feed a real example: `cat ~/apps/claude-code/statusline/examples/<file>.json | ~/.claude/.statusline/bin/cc-statusline` → rendered ANSI line.
5. On any failure: diagnose (runtime missing? bundle path? jq merge?), fix the
   relevant task, re-run. Do not loosen the success criteria.

Report: final `statusLine.command`, that the launcher runs, and a sample of the
rendered output.

## Out of scope (separate plan)

- Making `plugins-breno` a standalone PUBLIC github marketplace.
- Stripping personal plugins (whatsapp, google-mcps, reminders, paths) out.
- Standing up a separate PRIVATE experimental marketplace.
- Reworking how `claude-userland` references the split-out marketplace
  (submodule vs directory source vs github source).

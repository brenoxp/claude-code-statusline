#!/bin/bash
set -e

INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Snapshot working tree before formatting
BEFORE_HASH=$(git diff | md5sum)

# Format all project files (prettier skips unchanged ones quickly)
FORMAT_OUT=$(bun run format 2>&1) || {
  echo "Prettier failed:" >&2
  echo "$FORMAT_OUT" >&2
  exit 2
}

# If prettier changed anything (compare before/after working tree)
AFTER_HASH=$(git diff | md5sum)
if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
  FORMATTED=$(git diff --name-only 2>/dev/null || true)
  echo "Formatted:" >&2
  echo "$FORMATTED" >&2
fi

# Lint (unused imports/variables)
LINT_OUT=$(bun run lint 2>&1) || {
  echo "Lint failed:" >&2
  echo "$LINT_OUT" >&2
  exit 2
}

# Run tests
TEST_OUT=$(bash tests/run.sh 2>&1) || {
  echo "Tests failed:" >&2
  echo "$TEST_OUT" | tail -20 >&2
  exit 2
}

exit 0

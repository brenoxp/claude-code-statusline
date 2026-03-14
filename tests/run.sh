#!/bin/bash
# Test runner for claude-code-statusline
# Usage: bash tests/run.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST="$PROJECT_DIR/dist/index.js"

PASS=0
FAIL=0

pass() { ((PASS++)); printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { ((FAIL++)); printf "  \033[31m✗\033[0m %s (got: %s)\n" "$1" "$2"; }

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then
        pass "$label"
    else
        fail "$label" "'$actual' expected '$expected'"
    fi
}

assert_contains() {
    local label="$1" haystack="$2" needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        pass "$label"
    else
        fail "$label" "output missing '$needle'"
    fi
}

assert_not_empty() {
    local label="$1" value="$2"
    if [[ -n "$value" ]]; then
        pass "$label"
    else
        fail "$label" "empty"
    fi
}

# ── Build check ─────────────────────────────────────────
echo "build"
if [[ -f "$DIST" ]]; then
    pass "dist/index.js exists"
else
    fail "dist/index.js exists" "missing (run: bun run build)"
    echo ""
    printf "\033[31mbuild required, aborting\033[0m\n"
    exit 1
fi

# ── Location truncation ────────────────────────────────
echo "location truncation"
LONG_INPUT='{"session_id":"test","cwd":"/tmp/fake-long-path/apps/claude-code/statusline/.claude/worktrees/declarative-hugging-dragon","model":{"id":"claude-opus-4-5","display_name":"Opus 4.5"},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}'

# At COLUMNS=40, first line should be <= 40 chars
LINE_40=$(echo "$LONG_INPUT" | COLUMNS=40 bun "$DIST" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | head -1)
LEN_40=${#LINE_40}
if (( LEN_40 <= 40 )); then
    pass "path fits in 40 cols ($LEN_40 chars)"
else
    fail "path fits in 40 cols" "$LEN_40 chars"
fi

# At COLUMNS=60, first line should be <= 60 chars
LINE_60=$(echo "$LONG_INPUT" | COLUMNS=60 bun "$DIST" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | head -1)
LEN_60=${#LINE_60}
if (( LEN_60 <= 60 )); then
    pass "path fits in 60 cols ($LEN_60 chars)"
else
    fail "path fits in 60 cols" "$LEN_60 chars"
fi

# Short path should not be truncated
SHORT_INPUT='{"session_id":"test","cwd":"/tmp/myapp","model":{"id":"claude-opus-4-5","display_name":"Opus 4.5"},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}'
LINE_SHORT=$(echo "$SHORT_INPUT" | COLUMNS=80 bun "$DIST" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | head -1)
assert_contains "short path not truncated" "$LINE_SHORT" "/tmp/myapp"

# ── Integration: TEST_MODE output ────────────────────────
echo "integration"
OUTPUT=$(TEST_MODE=true bun "$DIST" 2>&1)
assert_not_empty "TEST_MODE produces output" "$OUTPUT"
assert_contains "output has model name" "$OUTPUT" "Opus"
assert_contains "output has example path" "$OUTPUT" "myapp"

# ── Integration: debug mode ──────────────────────────────
echo "debug mode"
DEBUG_OUTPUT=$(STATUSLINE_DEBUG=true TEST_MODE=true bun "$DIST" 2>&1)
assert_contains "debug shows timing" "$DEBUG_OUTPUT" "total:"

# ── Sanitization ─────────────────────────────────────────
echo "sanitization"
LOCAL_USER=$(whoami)
LEAKS=$(grep -r "/Users/$LOCAL_USER" "$PROJECT_DIR" \
    --include='*.sh' --include='*.json' --include='*.md' --include='*.mjs' --include='*.ts' --include='*.svelte' \
    --exclude-dir=.git --exclude-dir=.cache --exclude-dir=node_modules --exclude-dir=tests \
    --exclude-dir=logs --exclude-dir=.claude --exclude-dir=dist \
    2>/dev/null | grep -v 'CLAUDE.md' || true)
assert_eq "no personal paths leaked" "" "$LEAKS"

# ── Summary ──────────────────────────────────────────────
echo ""
TOTAL=$((PASS + FAIL))
if [[ "$FAIL" -eq 0 ]]; then
    printf "\033[32m%d/%d tests passed\033[0m\n" "$PASS" "$TOTAL"
    exit 0
else
    printf "\033[31m%d/%d tests failed\033[0m\n" "$FAIL" "$TOTAL"
    exit 1
fi

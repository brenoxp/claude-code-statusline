#!/bin/bash
# Benchmark: statusline render performance
# Runs 10 times, measures wall clock including process spawn

set -euo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$BENCH_DIR/.." && pwd)"
DIST="$ROOT_DIR/dist/index.js"
EXAMPLES_DIR="$ROOT_DIR/examples"
RUNS=10

INPUT_FILE="$EXAMPLES_DIR/input_with_context.json"
if [[ ! -f "$INPUT_FILE" ]]; then
    INPUT_FILE="$EXAMPLES_DIR/input.json"
fi

if [[ ! -f "$DIST" ]]; then
    echo "dist/index.js not found. Run: bun run build" >&2
    exit 1
fi

echo "Running $RUNS iterations (output suppressed)"
echo ""

total=0
for ((i=1; i<=RUNS; i++)); do
    t0=$(date +%s%N)
    cat "$INPUT_FILE" | COLUMNS=80 bun "$DIST" > /dev/null
    t1=$(date +%s%N)
    elapsed=$(( (t1 - t0) / 1000000 ))
    total=$((total + elapsed))
done
avg=$((total / RUNS))
printf "total=%dms  avg=%dms\n" "$total" "$avg"

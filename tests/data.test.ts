// Unit tests for transcript data gathering. Run via `bun test tests/`.
import { test, expect } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sumSessionCacheTokens } from "../src/lib/data";

function withTranscript(entries: object[], run: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "statusline-data-"));
  const path = join(dir, "transcript.jsonl");
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  try {
    run(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assistantLine(
  messageId: string | undefined,
  blockType: string,
  cacheCreation: number,
  outputTokens: number,
) {
  return {
    type: "assistant",
    message: {
      ...(messageId ? { id: messageId } : {}),
      role: "assistant",
      content: [{ type: blockType }],
      usage: {
        input_tokens: 10,
        output_tokens: outputTokens,
        cache_creation_input_tokens: cacheCreation,
        cache_read_input_tokens: 0,
      },
    },
  };
}

test("sumSessionCacheTokens: response split across lines counts once", () => {
  withTranscript(
    [
      { type: "user", message: { role: "user", content: "hi" } },
      assistantLine("msg_a", "thinking", 30000, 5),
      assistantLine("msg_a", "text", 30000, 40),
      assistantLine("msg_a", "tool_use", 30000, 120),
      assistantLine("msg_b", "text", 6000, 80),
    ],
    (path) => expect(sumSessionCacheTokens(path)).toBe(36000),
  );
});

test("sumSessionCacheTokens: uses the last line of each response", () => {
  withTranscript(
    [
      assistantLine("msg_a", "thinking", 1000, 5),
      assistantLine("msg_a", "text", 1200, 40),
    ],
    (path) => expect(sumSessionCacheTokens(path)).toBe(1200),
  );
});

test("sumSessionCacheTokens: lines without message.id count as-is", () => {
  withTranscript(
    [
      assistantLine(undefined, "text", 25000, 50),
      assistantLine(undefined, "text", 12000, 100),
      assistantLine("msg_a", "text", 500, 10),
      assistantLine("msg_a", "tool_use", 500, 20),
    ],
    (path) => expect(sumSessionCacheTokens(path)).toBe(37500),
  );
});

test("sumSessionCacheTokens: missing transcript returns 0", () => {
  expect(sumSessionCacheTokens(undefined)).toBe(0);
  expect(sumSessionCacheTokens("/nonexistent/transcript.jsonl")).toBe(0);
});

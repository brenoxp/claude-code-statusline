<script>
  import { Box, Text } from "nib-ink";
  import { toRgb, theme } from "../lib/theme";

  let {
    promptText = null,
    isVoice = false,
    maxWidth = 80,
    minPromptLineWidth = null,
    maxPromptLineWidth = null,
  } = $props();

  const voicePrefix = isVoice ? "[voice] " : "";
  const cleanText = (promptText ?? "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const maxLen = maxPromptLineWidth ?? maxWidth;
</script>

{#if promptText}
  <Box flexDirection="row" gap={1}>
    <Text color={toRgb(theme.slate)}>❯</Text>
    <Box flexShrink={1} width={maxLen - 2}>
      <Text wrap="truncate" color={toRgb(theme.prompt)}
        >{voicePrefix}{cleanText}</Text
      >
    </Box>
  </Box>
{/if}

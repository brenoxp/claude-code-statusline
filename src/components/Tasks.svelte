<script>
  import { Box, Text } from "nib-ink";
  import { toRgb, theme } from "../lib/theme";

  let { completedTask = null, currentTask = null } = $props();
</script>

{#if completedTask}
  <Box flexDirection="row" gap={1}>
    <Text color={toRgb(theme.slate)} dimColor>✓</Text>
    <Box flexShrink={1}>
      <Text wrap="truncate" color={toRgb(theme.slate)} dimColor
        >{completedTask}</Text
      >
    </Box>
  </Box>
{/if}
{#if currentTask}
  <Box flexDirection="row" gap={1}>
    <Text color={toRgb(theme.muted)}>→</Text>
    <Box flexShrink={1}>
      <Text wrap="truncate" color={toRgb(theme.muted)}>{currentTask}</Text>
    </Box>
  </Box>
{/if}

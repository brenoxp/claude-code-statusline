<script>
  import { Box, Text } from "nib-ink";
  import { toRgb, theme } from "../lib/theme";

  let { cliCount, mcpCount } = $props();
</script>

<Box flexDirection="row" gap={2}>
  <Box flexShrink={0}
    ><Text color={toRgb(theme.purple)} bold>◆ {cliCount} cli</Text></Box
  >
  <Box flexShrink={1}
    ><Text wrap="truncate" color={toRgb(theme.slate)} dimColor
      >◇ {mcpCount} mcp</Text
    ></Box
  >
</Box>

<script>
  import { Box, Text } from "nib-ink";
  import { theme, toRgb } from "../lib/theme";

  let {
    path,
    branch = null,
    additions = null,
    deletions = null,
    maxWidth,
  } = $props();

  const fixedWidth =
    (additions != null ? `+${additions}`.length + 2 : 0) +
    (deletions != null ? `-${deletions}`.length + 2 : 0);
  const showBranch = branch && maxWidth - fixedWidth - 15 - 2 >= 8;
</script>

<Box flexDirection="row" gap={2}>
  <Box flexShrink={1} minWidth={15}>
    <Text
      wrap="truncate-middle"
      truncatePosition={0.25}
      bold
      color={toRgb(theme.green)}>{path}</Text
    >
  </Box>
  {#if showBranch}
    <Box flexShrink={2} minWidth={8}>
      <Text wrap="truncate" color={toRgb(theme.label)}>{branch}</Text>
    </Box>
  {/if}
  {#if additions != null}
    <Box flexShrink={0}
      ><Text color={toRgb(theme.green)}>+{additions}</Text></Box
    >
  {/if}
  {#if deletions != null}
    <Box flexShrink={0}><Text color={toRgb(theme.red)}>-{deletions}</Text></Box>
  {/if}
</Box>

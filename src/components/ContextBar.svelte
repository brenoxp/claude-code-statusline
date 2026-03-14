<script>
  import { Box, Text } from "nib-ink";
  import ProgressBar from "./ProgressBar.svelte";
  import { theme, toRgb, ctxRgb, formatTokensCompact } from "../lib/theme";

  let { modelName, contextPct, tokenCount, cacheWriteTokens } = $props();

  const [cr, cg, cb] = ctxRgb(contextPct);
  const pctFmt = String(contextPct).padStart(3) + "%";
  const pctColor = toRgb(ctxRgb(contextPct));
  const compact = formatTokensCompact(tokenCount);
  const cacheWrite =
    cacheWriteTokens > 0 ? `✎${formatTokensCompact(cacheWriteTokens)}` : null;
</script>

<Box flexDirection="row" gap={2}>
  <Box flexShrink={0} width={8}
    ><Text color={toRgb(theme.model)} bold>{modelName}</Text></Box
  >
  <Box flexShrink={0}
    ><ProgressBar pct={contextPct} width={10} color={[cr, cg, cb]} /></Box
  >
  <Box flexShrink={0}
    ><Text color={pctColor} inverse={contextPct >= 80}>{pctFmt}</Text></Box
  >
  <Box flexShrink={1}
    ><Text wrap="truncate" color={toRgb(theme.slate)} dimColor>{compact}</Text
    ></Box
  >
  {#if cacheWrite}
    <Box flexShrink={1}
      ><Text wrap="truncate" color={toRgb(theme.slate)} dimColor
        >{cacheWrite}</Text
      ></Box
    >
  {/if}
</Box>

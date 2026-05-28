<script>
  import { Box, Text } from "nib-ink";
  import ProgressBar from "./ProgressBar.svelte";
  import { rateRgb, toRgb, theme } from "../lib/theme";

  let { session = null, weekly = null } = $props();
</script>

{#if session}
  {@const pctFmt = String(session.pct).padStart(3) + "%"}
  <Box flexDirection="row" gap={2}>
    <Box flexShrink={0} width={8}
      ><Text color={toRgb(theme.label)}>session</Text></Box
    >
    <Box flexShrink={0}
      ><ProgressBar
        pct={session.pct}
        width={10}
        color={rateRgb(session.pct)}
      /></Box
    >
    <Box flexShrink={0}
      ><Text color={toRgb(rateRgb(session.pct))} inverse={session.pct >= 90}
        >{pctFmt}</Text
      ></Box
    >
    {#if session.resetCountdown}
      <Box flexShrink={1}
        ><Text wrap="truncate" color={toRgb(theme.slate)} dimColor
          >{session.resetCountdown}</Text
        ></Box
      >
    {/if}
  </Box>
{/if}

{#if weekly}
  {@const wPctFmt = String(weekly.pct).padStart(3) + "%"}
  <Box flexDirection="row" gap={2}>
    <Box flexShrink={0} width={8}
      ><Text color={toRgb(theme.label)}>weekly</Text></Box
    >
    <Box flexShrink={0}
      ><ProgressBar
        pct={weekly.pct}
        width={10}
        color={rateRgb(weekly.pct)}
      /></Box
    >
    <Box flexShrink={0}
      ><Text color={toRgb(rateRgb(weekly.pct))} inverse={weekly.pct >= 90}
        >{wPctFmt}</Text
      ></Box
    >
    {#if weekly.resetCountdown}
      <Box flexShrink={1}
        ><Text wrap="truncate" color={toRgb(theme.slate)} dimColor
          >{weekly.resetCountdown}</Text
        ></Box
      >
    {/if}
  </Box>
{/if}

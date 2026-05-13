<script>
  import { Box, Text } from "nib-ink";
  import ProgressBar from "./ProgressBar.svelte";
  import { rateRgb, toRgb, theme } from "../lib/theme";

  let { session = null, weekly = null } = $props();
</script>

{#if session}
  {@const sessionDim = session.stale || session.apiFailed}
  {@const [sr, sg, sb] = sessionDim ? theme.slate : rateRgb(session.pct)}
  {@const pctFmt = String(session.pct).padStart(3) + "%"}
  {@const pctColor = sessionDim
    ? toRgb(theme.slate)
    : toRgb(rateRgb(session.pct))}
  <Box flexDirection="row" gap={2}>
    <Box flexShrink={0} width={8}
      ><Text color={toRgb(theme.label)}>session</Text></Box
    >
    <Box flexShrink={0}
      ><ProgressBar pct={session.pct} width={10} color={[sr, sg, sb]} /></Box
    >
    <Box flexShrink={0}
      ><Text
        color={pctColor}
        inverse={!sessionDim && session.pct >= 90}
        dimColor={sessionDim}>{pctFmt}</Text
      ></Box
    >
    {#if session.resetCountdown}
      <Box flexShrink={1}
        ><Text wrap="truncate" color={toRgb(theme.slate)} dimColor
          >{session.resetCountdown}</Text
        ></Box
      >
    {/if}
    {#if session.promoStatus}
      <Box flexShrink={1}>
        {#if session.promoStatus.active}
          <Text wrap="truncate" color={toRgb(theme.green)}
            >⚡2x {session.promoStatus.time} left</Text
          >
        {:else}
          <Text wrap="truncate" color={toRgb(theme.slate)}
            >⚡2x in {session.promoStatus.time}</Text
          >
        {/if}
      </Box>
    {/if}
  </Box>
{/if}

{#if weekly}
  {@const weeklyDim = weekly.stale || weekly.apiFailed}
  {@const [wr, wg, wb] = weeklyDim ? theme.slate : rateRgb(weekly.pct)}
  {@const wPctFmt = String(weekly.pct).padStart(3) + "%"}
  {@const wPctColor = weeklyDim
    ? toRgb(theme.slate)
    : toRgb(rateRgb(weekly.pct))}
  <Box flexDirection="row" gap={2}>
    <Box flexShrink={0} width={8}
      ><Text color={toRgb(theme.label)}>weekly</Text></Box
    >
    <Box flexShrink={0}
      ><ProgressBar pct={weekly.pct} width={10} color={[wr, wg, wb]} /></Box
    >
    <Box flexShrink={0}
      ><Text
        color={wPctColor}
        inverse={!weeklyDim && weekly.pct >= 90}
        dimColor={weeklyDim}>{wPctFmt}</Text
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

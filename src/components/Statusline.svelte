<script lang="ts">
  import { Box, Text } from "nib-ink";
  import Location from "./Location.svelte";
  import ContextBar from "./ContextBar.svelte";
  import UsageLimits from "./UsageLimits.svelte";
  import Processes from "./Processes.svelte";
  import Tasks from "./Tasks.svelte";
  import Prompt from "./Prompt.svelte";
  import { theme, toRgb } from "../lib/theme";

  let {
    path,
    branch,
    additions,
    deletions,
    modelName,
    contextPct,
    tokenCount,
    cacheWriteTokens,
    session,
    weekly,
    cliCount,
    mcpCount,
    completedTask,
    currentTask,
    promptText,
    isVoice,
    maxWidth,
    minPromptLineWidth,
    maxPromptLineWidth,
    latestVersion = null,
  } = $props();

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const timeStr = `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
</script>

<Box flexDirection="column" width={maxWidth}>
  <Location {path} {branch} {additions} {deletions} {maxWidth} />
  <ContextBar {modelName} {contextPct} {tokenCount} {cacheWriteTokens} />
  {#if session || weekly}
    <UsageLimits {session} {weekly} />
  {/if}
  <Processes {cliCount} {mcpCount} />
  {#if completedTask || currentTask}
    <Tasks {completedTask} {currentTask} />
  {/if}
  {#if promptText}
    <Prompt
      {promptText}
      {isVoice}
      {maxWidth}
      {minPromptLineWidth}
      {maxPromptLineWidth}
    />
  {/if}
  <Box flexDirection="row" gap={2}>
    <Text color={toRgb(theme.slate)}>{timeStr}</Text>
    {#if latestVersion}
      <Text color={toRgb(theme.green)}>↑ v{latestVersion}</Text>
    {/if}
  </Box>
</Box>

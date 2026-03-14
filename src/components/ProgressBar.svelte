<script lang="ts">
  import { Text } from "nib-ink";
  import { theme, toRgb, type RgbTuple } from "../lib/theme";

  let {
    pct,
    color,
    width = 10,
  }: { pct: number; color: RgbTuple; width?: number } = $props();

  const fillChar = "●";
  const emptyChar = "○";
  const [lr, lg, lb] = theme.barLerp;

  // 10x precision for fractional dot gradient
  const filledX10 = $derived(Math.floor((pct * width * 10) / 100));
  const filledCount = $derived(Math.floor(filledX10 / 10));
  const frac = $derived(filledX10 % 10);

  // Partial dot: lerp from barLerp (white) toward fill color
  const partialColor = $derived.by((): RgbTuple | null => {
    if (filledCount >= width || frac === 0) return null;
    const [cr, cg, cb] = color;
    return [
      Math.floor((lr * (10 - frac) + cr * frac) / 10),
      Math.floor((lg * (10 - frac) + cg * frac) / 10),
      Math.floor((lb * (10 - frac) + cb * frac) / 10),
    ];
  });

  const totalFilled = $derived(filledCount + (partialColor ? 1 : 0));
  const emptyCount = $derived(Math.max(0, width - totalFilled));

  const filledStr = $derived(Array(filledCount).fill(fillChar).join(" "));
  const emptyStr = $derived(Array(emptyCount).fill(emptyChar).join(" "));
</script>

<Text
  >{#if filledStr}<Text color={toRgb(color)}>{filledStr}</Text
    >{/if}{#if partialColor}{filledStr ? " " : ""}<Text
      color={toRgb(partialColor)}>{fillChar}</Text
    >{/if}{#if emptyStr}{totalFilled > 0 ? " " : ""}<Text
      color={toRgb(theme.barDim)}
      dimColor>{emptyStr}</Text
    >{/if}</Text
>

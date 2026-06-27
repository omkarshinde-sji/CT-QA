/** Parse PR numbers from comma/space-separated input or array. */
export function parsePrNumbersInput(raw: string): number[] {
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => s.replace(/^#/, "").trim())
    .filter(Boolean);

  const nums = parts
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n) && n > 0 && Number.isInteger(n));

  return [...new Set(nums)].sort((a, b) => a - b);
}

export function formatPrNumbersLabel(prNumbers: number[]): string {
  if (!prNumbers.length) return "";
  if (prNumbers.length === 1) return `#${prNumbers[0]}`;
  return prNumbers.map((n) => `#${n}`).join(", ");
}

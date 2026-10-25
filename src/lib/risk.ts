/** Display the internal 0–100 fused score on the PDF's integer 1–10 scale. */
export function riskOutOfTen(score: number): number {
  return Math.max(1, Math.min(10, Math.round(score / 10)));
}

/**
 * The PDF's four bands. `tint` and `dot` are alpha-derived from the same band
 * colour as `text`, which is what gives the mockups' pale cell with a stronger
 * circle inside it. Ordered low to high; `riskBand` walks it backwards.
 */
export const RISK_BANDS = [
  {
    label: "Low",
    range: "1–3",
    min: 1,
    text: "text-calm",
    tint: "border-calm/30 bg-calm/15",
    dot: "bg-calm/35",
  },
  {
    label: "Watch",
    range: "4–5",
    min: 4,
    text: "text-slight",
    tint: "border-slight/30 bg-slight/15",
    dot: "bg-slight/35",
  },
  {
    label: "Elevated",
    range: "6–7",
    min: 6,
    text: "text-worried",
    tint: "border-worried/30 bg-worried/15",
    dot: "bg-worried/35",
  },
  {
    label: "High",
    range: "8–10",
    min: 8,
    text: "text-very",
    tint: "border-very/30 bg-very/15",
    dot: "bg-very/35",
  },
] as const;

export type RiskBand = (typeof RISK_BANDS)[number];

export function riskBand(score: number): RiskBand {
  const risk = riskOutOfTen(score);
  return (
    [...RISK_BANDS].reverse().find((b) => risk >= b.min) ?? RISK_BANDS[0]
  );
}

export function riskTone(score: number): string {
  return riskBand(score).text;
}

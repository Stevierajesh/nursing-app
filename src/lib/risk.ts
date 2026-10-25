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

/** Display priority is distinct from the combined model's 1–10 number.
 * Acknowledgement does not close an escalation. Assessed/resolved records do
 * not keep a patient red. NEWS alone can raise priority without changing risk.
 */
export interface PriorityInput {
  risk_score: number;
  latest_news?: number | null;
  news_alert?: import("./types").NewsAlert;
  open_escalation?: Pick<import("./types").Escalation, "status"> | null;
}

export function patientPriority(patient: PriorityInput) {
  const combined = riskBand(patient.risk_score);
  const status = patient.open_escalation?.status;
  const news = patient.news_alert?.score ?? patient.latest_news;
  const newsBand = patient.news_alert?.band ?? (news == null ? "unknown" : news >= 7 ? "high" : news >= 5 ? "medium" : news > 0 ? "low" : "none");
  const newsLabel = news == null ? "NEWS unavailable" : `NEWS ${news} · ${newsBand === "single_red" ? "Single parameter 3" : newsBand === "medium" ? "Medium" : newsBand === "high" ? "High" : newsBand === "unknown" ? "Unavailable" : newsBand === "none" ? "Zero" : "Low"}`;
  if (status === "open" || status === "acknowledged" || status === "auto_escalated") {
    return { band: RISK_BANDS[3], rank: 3, label: status === "acknowledged" ? "Escalation acknowledged" : status === "auto_escalated" ? "Escalation overdue" : "Escalation open", reason: `${newsLabel} · Assessment or resolution pending` };
  }
  if (newsBand === "high") return { band: RISK_BANDS[3], rank: 3, label: newsLabel, reason: "NEWS high response threshold" };
  const combinedRank = RISK_BANDS.indexOf(combined);
  if ((newsBand === "medium" || newsBand === "single_red") && combinedRank < 3) {
    return { band: RISK_BANDS[2], rank: 2, label: newsLabel, reason: "NEWS urgent review threshold" };
  }
  return { band: combined, rank: combinedRank, label: `Combined score ${combined.label.toLowerCase()}`, reason: newsLabel };
}

export function detailPriority(detail: import("./types").PatientDetail) {
  return patientPriority({
    risk_score: detail.risk.score,
    latest_news: detail.risk.latest_news,
    news_alert: detail.news_alert,
    open_escalation: detail.escalations.find(escalation => ["open", "acknowledged", "auto_escalated"].includes(escalation.status)) ?? null,
  });
}

/** Highest display priority first; active escalations win ties over the model. */
export function comparePatientPriority(a: PriorityInput, b: PriorityInput): number {
  const active = (patient: PriorityInput) => ["open", "acknowledged", "auto_escalated"].includes(patient.open_escalation?.status ?? "");
  return patientPriority(b).rank - patientPriority(a).rank
    || Number(active(b)) - Number(active(a))
    || (b.news_alert?.score ?? b.latest_news ?? -1) - (a.news_alert?.score ?? a.latest_news ?? -1)
    || b.risk_score - a.risk_score;
}

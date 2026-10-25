import { patientPriority, riskOutOfTen, type PriorityInput } from "../lib/risk";

export default function ClinicalPriority({ patient }: { patient: PriorityInput }) {
  const priority = patientPriority(patient);
  return <div aria-label="Patient priority" className={`rounded-xl border p-3 ${priority.band.tint} ${priority.band.text}`}>
    <p className="text-sm font-bold">{priority.label}</p>
    <p className="mt-1 text-xs">{priority.reason}</p>
    <p className="mt-2 text-xs font-medium text-ink-400">Combined score {riskOutOfTen(patient.risk_score)}/10</p>
  </div>;
}

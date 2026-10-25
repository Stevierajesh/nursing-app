import { Link } from "react-router-dom";
import { patientPriority, riskBand, riskOutOfTen } from "../lib/risk";
import { REASON_LABELS, WORRY_LABELS, type Patient } from "../lib/types";

export default function PatientsTable({ patients, unitNames, reviewIds = {} }: {
  patients: Patient[];
  unitNames: Record<string, string>;
  reviewIds?: Record<string, string>;
}) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[640px] text-left text-sm">
      <caption className="sr-only">Patients with combined risk scores, nurse concern, reasons, and priority bands</caption>
      <thead className="border-b border-ink-600 text-xs text-ink-400">
        <tr>
          <th scope="col" className="w-20 px-2 pb-3 font-medium">Risk</th>
          <th scope="col" className="w-[26%] px-3 pb-3 font-medium">Patient</th>
          <th scope="col" className="w-[21%] px-3 pb-3 font-medium">Nurse level</th>
          <th scope="col" className="px-3 pb-3 font-medium">Reason</th>
          <th scope="col" className="w-28 px-3 pb-3 font-medium">Band</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-700">
        {patients.map(patient => {
          const score = riskOutOfTen(patient.risk_score);
          const combined = riskBand(patient.risk_score);
          const priority = patientPriority(patient);
          const worry = patient.latest_worry;
          const reason = worry?.reasons.length
            ? worry.reasons.map(r => REASON_LABELS[r] ?? r).join(", ")
            : worry?.note || (worry?.level === 0 ? "No concerns recorded" : "—");
          const escalation = patient.open_escalation;
          const activeEscalation = escalation && ["open", "acknowledged", "auto_escalated"].includes(escalation.status);
          return <tr key={patient.id} className="transition-colors hover:bg-ink-800/80 focus-within:bg-ink-800">
            <td className={`px-2 py-3 ${combined.text}`}>
              <div className="w-12 text-center" aria-label={`Combined risk ${score} out of 10`}>
                <div className="flex h-7 items-end justify-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, index) => <span key={index} className={`w-0.5 rounded-t-sm ${index < score ? "bg-current" : "bg-ink-600"}`} style={{ height: `${6 + index * 2}px` }} />)}
                </div>
                <span aria-hidden="true" className="mt-1 block text-[11px] font-bold tabular-nums">{score}/10</span>
              </div>
            </td>
            <th scope="row" className="px-3 py-3 font-normal">
              <Link to={reviewIds[patient.id] ? `/review/${reviewIds[patient.id]}` : activeEscalation ? `/respond/${patient.id}` : `/worry/${patient.id}`} className="block rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                <span className="block font-semibold text-ink-200">{patient.bed ? `Bed ${patient.bed}` : patient.display_name}</span>
                {patient.bed && <span className="mt-0.5 block text-xs text-ink-200">{patient.display_name}</span>}
                <span className="mt-0.5 block text-xs text-ink-400">{[patient.room ? `Room ${patient.room}` : "No room assigned", patient.unit_id ? unitNames[patient.unit_id] : null].filter(Boolean).join(" · ")}</span>
              </Link>
            </th>
            <td className="px-3 py-3 text-ink-200">{worry ? WORRY_LABELS[worry.level] : <span className="text-ink-400">Not recorded</span>}</td>
            <td className="max-w-56 px-3 py-3 text-xs leading-5 text-ink-400">{reason}</td>
            <td className="px-3 py-3">
              <span title={`${priority.label} · ${priority.reason}`} className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${priority.band.tint} ${priority.band.text}`}>{priority.band.label}</span>
              {(activeEscalation || priority.band.label !== combined.label) && <span className={`mt-1 block text-[10px] leading-4 ${priority.band.text}`}>{priority.label}</span>}
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

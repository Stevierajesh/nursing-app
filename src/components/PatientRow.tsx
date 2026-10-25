import { Link } from "react-router-dom";
import { REASON_LABELS, WORRY_LABELS, type Patient } from "../lib/types";
import { patientLocation } from "../lib/patientOrder";
import { riskOutOfTen, riskTone } from "../lib/risk";
import { timeAgo } from "./Primitives";

export default function PatientRow({
  patient: p,
  action,
  unitName,
}: {
  patient: Patient;
  action?: string;
  unitName?: string;
}) {
  const risk = riskOutOfTen(p.risk_score);
  return (
    <li className="border-b border-ink-700 py-4">
      <Link
        to={action === "Respond" ? `/respond/${p.id}` : `/worry/${p.id}`}
        className="flex min-h-16 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div className={`w-12 shrink-0 text-center ${riskTone(p.risk_score)}`}>
          <div
            className="mb-1 flex h-8 items-end justify-center gap-0.5"
            aria-hidden
          >
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`w-0.5 rounded-t-sm ${i < risk ? "bg-current" : "bg-ink-700"}`}
                style={{ height: `${8 + i * 2.5}px` }}
              />
            ))}
          </div>
          <span className="text-sm font-bold tabular-nums">{risk}/10</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-200">{patientLocation(p)}</div>
          <div className="truncate text-sm">{p.display_name}</div>
          {unitName && <p className="mt-1 text-xs text-ink-400">{unitName}</p>}
          {p.is_simulated && <p className="text-xs text-slight">Simulated patient</p>}
          {p.latest_vitals && <p className="mt-1 text-xs tabular-nums text-ink-400">HR {p.latest_vitals.heart_rate ?? "—"} · RR {p.latest_vitals.resp_rate ?? "—"} · SpO₂ {p.latest_vitals.spo2 ?? "—"}% · BP {p.latest_vitals.systolic_bp ?? "—"}/{p.latest_vitals.diastolic_bp ?? "—"}</p>}
          <p className="mt-1 text-xs leading-5 text-ink-400">
            Risk {risk}/10 ·{" "}
            {p.latest_worry
              ? WORRY_LABELS[p.latest_worry.level]
              : "No worry recorded"}
            {p.latest_worry?.reasons.length
              ? ` · ${p.latest_worry.reasons.map((r) => REASON_LABELS[r]).join(", ")}`
              : ""}
            {p.open_escalation
              ? ` · ${p.open_escalation.status === "auto_escalated" ? "Overdue" : p.open_escalation.status === "acknowledged" ? "Acknowledged" : "Open"} · raised ${timeAgo(p.open_escalation.triggered_at)}`
              : ""}
          </p>
        </div>
        {action && (
          <span className="shrink-0 rounded-full border border-accent px-3 py-3 text-xs font-semibold text-accent">
            {action}
          </span>
        )}
      </Link>
    </li>
  );
}

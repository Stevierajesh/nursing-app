import { useState } from "react";
import { Card, ErrorNote, Spinner } from "../components/Primitives";
import EscalationActions from "../components/EscalationActions";
import PatientRow from "../components/PatientRow";
import { usePatients } from "../lib/patients";
import type { Patient } from "../lib/types";

/** Unacknowledged is the mockup's "needs action": nobody has seen it yet. */
const needsAction = (p: Patient) => !p.open_escalation?.acknowledged_at;

export default function Alerts() {
  const { patients, loading, error } = usePatients();
  const [onlyAction, setOnlyAction] = useState(false);
  if (loading) return <Spinner label="Loading alerts" />;
  // Reuse priority ordering without the Board's three-patient limit.
  const groups = ["auto_escalated", "open", "acknowledged"];
  const alerts = groups.flatMap((status) =>
    patients
      .filter((p) => p.open_escalation?.status === status)
      .sort((a, b) => b.risk_score - a.risk_score),
  );
  const actionCount = alerts.filter(needsAction).length;
  const shown = onlyAction ? alerts.filter(needsAction) : alerts;
  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-4xl font-extrabold tracking-tight">Alerts</h1>
      <p className="text-sm text-ink-400">
        Open escalations for your active patients. Record acknowledgement and
        bedside assessment here.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
      {alerts.length > 0 && (
        <div role="group" aria-label="Filter alerts" className="flex flex-wrap gap-2">
          {[
            { label: "All", on: !onlyAction, set: false },
            { label: `Needs action · ${actionCount}`, on: onlyAction, set: true },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setOnlyAction(f.set)}
              aria-pressed={f.on}
              className={`min-h-11 rounded-full border px-5 text-xs font-semibold transition ${f.on ? "border-accent bg-accent text-white" : "border-ink-600 bg-ink-800 text-ink-200"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {alerts.length === 0 && !error ? (
        <Card>No open alerts.</Card>
      ) : shown.length === 0 ? (
        <Card>Every open alert has been acknowledged.</Card>
      ) : (
        <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
          {shown.map((p) => (
            <section key={p.id} aria-label={`Alert for ${p.display_name}`}>
              <ul>
                <PatientRow patient={p} action="Respond" />
              </ul>
              <EscalationActions patient={p} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

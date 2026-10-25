import { Link, useParams } from "react-router-dom";
import EscalationActions from "../components/EscalationActions";
import { Card, ErrorNote, Spinner } from "../components/Primitives";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { patientLocation } from "../lib/patientOrder";
import { riskBand, riskOutOfTen } from "../lib/risk";
import { REASON_LABELS, WORRY_LABELS } from "../lib/types";

export default function Response() {
  const { patientId } = useParams();
  const { me } = useAuth();
  const { patients, loading, error } = usePatients();
  const p = patients.find((p) => p.id === patientId);
  if (loading) return <Spinner />;
  const band = p ? riskBand(p.risk_score) : null;
  /*
   * Allergies distinguishes three states on purpose. An unrecorded field must
   * not look like data: a nurse reads a blank allergy line as "none known",
   * which is the one misreading that can hurt someone. Unrecorded is called
   * out in amber; an explicit empty array reads as "None known".
   */
  const allergies: { value: string; caution: boolean } = !p?.allergies
    ? { value: "Not recorded", caution: true }
    : p.allergies.length === 0
      ? { value: "None known", caution: false }
      : { value: p.allergies.join(", "), caution: false };

  const details = p
    ? [
        { label: "Patient", value: p.display_name },
        {
          label: "Age · sex",
          value:
            [p.age_band, p.sex].filter(Boolean).join(" · ") || "Not recorded",
        },
        { label: "Room", value: patientLocation(p) },
        {
          label: "Admitted",
          value: new Date(p.admitted_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        },
        { label: "Diagnosis", value: p.diagnosis || "Not recorded" },
        { label: "Allergies", ...allergies },
      ]
    : [];
  return (
    <div className="space-y-5 p-4">
      <Link to="/alerts" className="text-sm text-accent">
        ← Alerts
      </Link>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!p ? (
        <Card>Patient is no longer on your active list.</Card>
      ) : (
        <>
          <header>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
              {[p.room ? `Room ${p.room}` : null, me?.unit?.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
              {p.bed ? `Bed ${p.bed}` : p.display_name}
            </h1>
          </header>

          <Card>
            <dl className="grid grid-cols-2 gap-4">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs text-ink-400">{d.label}</dt>
                  <dd
                    className={`mt-1 font-semibold ${"caution" in d && d.caution ? "text-slight" : ""}`}
                  >
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {band && (
            <Card>
              <div className="flex items-center gap-4">
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold tabular-nums text-ink-200 ${band.dot}`}
                >
                  {riskOutOfTen(p.risk_score)}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${band.text}`}
                  >
                    Risk score · {band.label}
                  </p>
                  <p className="mt-1 font-semibold">
                    {p.latest_worry
                      ? `Nurse: ${WORRY_LABELS[p.latest_worry.level]}`
                      : "No worry recorded"}
                  </p>
                  {p.latest_worry?.reasons.length ? (
                    <p className="mt-1 text-sm text-ink-400">
                      {p.latest_worry.reasons
                        .map((r) => REASON_LABELS[r])
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          )}

          {p.open_escalation ? (
            <EscalationActions patient={p} />
          ) : (
            <Card>
              No open escalation. The response has been recorded or the alert is
              closed.
            </Card>
          )}
          <Link to={`/worry/${p.id}`} className="block text-accent">
            Review patient and record worry →
          </Link>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EscalationActions from "../components/EscalationActions";
import NurseNotes from "../components/NurseNotes";
import PatientHistory from "../components/PatientHistory";
import PatientVitals from "../components/PatientVitals";
import { Card, ErrorNote, Spinner } from "../components/Primitives";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { patientLocation } from "../lib/patientOrder";
import { patientPriority, riskOutOfTen } from "../lib/risk";
import { REASON_LABELS, WORRY_LABELS, type PatientDetail } from "../lib/types";

export default function Response() {
  const { patientId } = useParams();
  const { me } = useAuth();
  const { patients, loading, error, refresh } = usePatients();
  /*
   * The patient list carries one latest-vitals snapshot, not the series, so
   * this screen used to show an escalation with no observations behind it --
   * a nurse was asked to acknowledge a NEWS 7 without being shown the numbers
   * that produced it. Same detail fetch and 15s cadence as the worry screen.
   */
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const loadDetail = useCallback(
    () =>
      patientId
        ? api
            .get<PatientDetail>(`/api/v1/patients/${patientId}`)
            .then(setDetail)
            .catch(() => {
              /* The escalation actions below stay usable without the series. */
            })
        : Promise.resolve(),
    [patientId],
  );
  useEffect(() => {
    if (!patientId) return;
    void loadDetail();
    const timer = setInterval(() => void loadDetail(), 15000);
    return () => clearInterval(timer);
  }, [patientId, loadDetail]);

  // Charting a note or saving history changes both payloads: the note list
  // lives on the detail, the history columns on the patient row.
  const reload = useCallback(() => {
    void loadDetail();
    void refresh();
  }, [loadDetail, refresh]);
  const p = patients.find((p) => p.id === patientId);
  if (loading) return <Spinner />;
  const priority = p ? patientPriority(p) : null;
  const band = priority?.band;
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
            [p.age ?? p.age_band, p.sex].filter(Boolean).join(" · ") || "Not recorded",
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
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {p.bed ? `Bed ${p.bed}` : p.display_name}
            </h2>
          </header>

          {/* Same split as the worry screen: what happened on the left, what
              you do about it on the right. Stacked at desktop width the
              acknowledge buttons sat below the fold under six vitals cards,
              which is the wrong place for the only control on an overdue
              escalation. */}
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
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
                  aria-label="Latest NEWS" className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-full text-xl font-bold tabular-nums text-ink-200 ${band.dot}`}
                >
                  {p.latest_news ?? "—"}<span className="text-[10px]">NEWS</span>
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${band.text}`}
                  >
                    {priority?.label}
                  </p>
                  <p className={`mt-1 text-xs ${band.text}`}>{priority?.reason}</p>
                  <p className="mt-1 text-xs text-ink-400">Combined score {riskOutOfTen(p.risk_score)}/10</p>
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

          {/* Before the acknowledge form in reading order on purpose: read the
              observations, then respond to them. */}
          {detail && (
            <PatientVitals
              patient={detail.patient}
              vitals={detail.vitals}
              bands={detail.vital_bands}
            />
          )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {p.open_escalation ? (
              <EscalationActions patient={p} />
            ) : (
              <Card>
                No open escalation. The response has been recorded or the alert
                is closed.
              </Card>
            )}
            {me?.user.role !== "prescriber" && (
              <Link to={`/worry/${p.id}`} className="block text-accent">
                Review patient and record worry →
              </Link>
            )}

            {/* Sections 4 and 5 of the prescriber's approval review are fed
                from here. Before this screen could write them, both rendered
                "not recorded" for every patient in the system. */}
            <NurseNotes
              patientId={p.id}
              notes={detail?.nurse_notes ?? []}
              onCharted={reload}
            />
            <PatientHistory patient={p} onSaved={reload} />
          </div>
          </div>
        </>
      )}
    </div>
  );
}

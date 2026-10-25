import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, ErrorNote, Spinner } from "../components/Primitives";
import { usePatients } from "../lib/patients";
import { comparePatientPriority, patientPriority, riskOutOfTen } from "../lib/risk";
import { api } from "../lib/api";
import { WORRY_LABELS } from "../lib/types";
import type { MedicationReview } from "../lib/mobileTypes";

/*
 * The prescriber's landing screen (design doc page 22).
 *
 * It answers one question -- what is waiting on me -- and then gets out of the
 * way. The counts are the two things only a doctor can clear: an unacknowledged
 * escalation and an undecided medication request.
 */

const OPEN = ["pending", "escalated"];

export default function DoctorRisk() {
  const { patients, loading, error } = usePatients();
  const [reviews, setReviews] = useState<MedicationReview[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    api
      .get<{ reviews: MedicationReview[] }>("/api/v1/medication/reviews")
      .then((r) => live && setReviews(r.reviews.filter((x) => OPEN.includes(x.status))))
      .catch((e) =>
        live && setReviewError(e instanceof Error ? e.message : "Could not load requests."),
      );
    return () => {
      live = false;
    };
  }, []);

  if (loading) return <Spinner label="Loading your unit" />;

  const critical = patients.filter(
    (p) => p.open_escalation && !p.open_escalation.acknowledged_at,
  );
  const attention = [...patients]
    .filter((p) => patientPriority(p).rank >= 2)
    .sort(comparePatientPriority)
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorNote>{error}</ErrorNote>}
      {reviewError && <ErrorNote>{reviewError}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-extrabold tracking-tight">Needs your approval</h2>
          <p className="mt-1 text-sm text-ink-400">
            {critical.length + reviews.length === 0
              ? "Nothing is waiting on you right now."
              : `${critical.length + reviews.length} item${
                  critical.length + reviews.length === 1 ? "" : "s"
                } waiting: ${critical.length} unacknowledged escalation${
                  critical.length === 1 ? "" : "s"
                } and ${reviews.length} medication request${reviews.length === 1 ? "" : "s"}.`}
          </p>

          <dl className="mt-4 space-y-2">
            <div className="flex items-center justify-between border-b border-ink-700 pb-2">
              <dt className="text-sm">Unacknowledged escalations</dt>
              <dd className="text-sm font-extrabold text-very">{critical.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm">Medication requests waiting</dt>
              <dd className="text-sm font-extrabold text-slight">{reviews.length}</dd>
            </div>
          </dl>

          <Button className="mt-5 w-full" onClick={() => navigate("/alerts")}>
            Open Alerts
          </Button>

          {/* The doc promises push, SMS and a phone call here. None of those
              exist in the backend, so this says what actually happens. */}
          <p className="mt-4 rounded-2xl border border-very/25 bg-very/10 px-4 py-3 text-xs leading-relaxed">
            <span className="font-bold text-very">Red score?</span> The request
            is escalated to every prescriber on the unit if nobody responds
            inside the response window. Alerts appear in Salus while you are
            signed in.
          </p>
        </Card>

        <div>
          <h2 className="mb-3 border-b border-ink-700 pb-2 text-sm font-semibold text-ink-400">
            Needs attention first
          </h2>
          {attention.length === 0 ? (
            <p className="text-sm text-ink-400">No patient is above the watch threshold.</p>
          ) : (
            <ul className="divide-y divide-ink-700">
              {attention.map((p) => {
                const priority = patientPriority(p);
                const band = priority.band;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-sm font-extrabold text-ink-400">
                        {riskOutOfTen(p.risk_score)}/10
                      </p><span className="text-[10px] text-ink-400">Combined</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={reviews.find(review => review.patient_id === p.id) ? `/review/${reviews.find(review => review.patient_id === p.id)!.id}` : `/patients?q=${encodeURIComponent(p.display_name)}`} className="block truncate rounded text-sm font-bold hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                        {p.bed ? `Bed ${p.bed}` : p.display_name}
                        {p.room ? ` · Room ${p.room}` : ""}
                        <span className="block text-xs font-normal">{p.display_name}</span>
                      </Link>
                      <p className={`truncate text-xs ${band.text}`}>
                        {priority.label}
                        {p.latest_worry
                          ? ` · Nurse: ${WORRY_LABELS[p.latest_worry.level]}`
                          : ""}
                      </p>
                      <p className={`mt-1 text-xs ${band.text}`}>{priority.reason}</p>
                    </div>
                    {/* Searching by name rather than id: matchesQuery already
                        indexes display_name, and a bed number alone collides
                        with room numbers ("12" also matches Room 412). */}
                    <Link
                      to={reviews.find(review => review.patient_id === p.id) ? `/review/${reviews.find(review => review.patient_id === p.id)!.id}` : `/patients?q=${encodeURIComponent(p.display_name)}`}
                      className="min-h-11 shrink-0 rounded-full border border-accent px-5 text-sm font-semibold leading-[2.75rem] text-accent"
                    >
                      Review
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

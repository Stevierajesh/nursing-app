import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, ErrorNote, Spinner, timeAgo } from "../components/Primitives";
import { api } from "../lib/api";
import { CONDITIONS } from "../lib/mobileTypes";
import type { MedicationReview } from "../lib/mobileTypes";

/*
 * The prescriber's approval queue (design doc page 26).
 *
 * Two states are shown distinctly because they mean different things: a
 * pending request is one person's job, an escalated one has already blown its
 * response window and belongs to whoever picks it up.
 *
 * The doc's "Recent notifications" rail is not built. There is no notification
 * table in the schema, so the list could only be invented, and a fabricated
 * delivery log is exactly the kind of thing a clinician would reasonably
 * believe.
 */

const OPEN = ["pending", "escalated"];

export default function DoctorAlerts() {
  const [reviews, setReviews] = useState<MedicationReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { reviews } = await api.get<{ reviews: MedicationReview[] }>(
        "/api/v1/medication/reviews",
      );
      setReviews(reviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your queue.");
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/api/v1/medication/reviews/${id}`, {
        action: "acknowledge",
        note: "Seen; review to follow",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not acknowledge.");
    } finally {
      setBusyId(null);
    }
  }

  if (reviews === null) return <Spinner label="Loading your queue" />;

  const open = reviews.filter((r) => OPEN.includes(r.status));
  const closed = reviews.filter((r) => !OPEN.includes(r.status)).slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mt-1 text-sm text-ink-400">
          Medication requests waiting for your approval.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-400">Needs your approval</h2>
          {open.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-400">
                Nothing is waiting on you. Requests appear here the moment a
                nurse sends one.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {open.map((r) => {
                const escalated = r.status === "escalated";
                return (
                  <li key={r.id}>
                    <div
                      className={`rounded-3xl border p-5 ${
                        escalated
                          ? "border-very/40 bg-very/10"
                          : "border-ink-700 bg-ink-800"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link to={`/review/${r.id}`} className="rounded text-lg font-extrabold tracking-tight hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                          {r.patient?.display_name ?? "Patient"}
                          <span className="mt-1 block text-xs font-normal text-ink-400">{[r.patient?.bed ? `Bed ${r.patient.bed}` : null, r.patient?.room ? `Room ${r.patient.room}` : null].filter(Boolean).join(" · ")}</span>
                        </Link>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                            escalated
                              ? "bg-very/20 text-very"
                              : "bg-slight/15 text-slight"
                          }`}
                        >
                          {escalated ? "Escalated" : "Needs approval"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm">
                        {CONDITIONS[r.condition]} medication suggested by the nurse
                        {r.suggested_class ? `: ${r.suggested_class.label}` : ""}.
                      </p>
                      <p className="mt-1 text-xs text-ink-400">
                        Waiting {timeAgo(r.created_at)}
                        {r.acknowledged_at ? " · you acknowledged this" : ""}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {!r.acknowledged_at && (
                          <Button
                            variant="ghost"
                            disabled={busyId === r.id}
                            onClick={() => acknowledge(r.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button onClick={() => navigate(`/review/${r.id}`)}>
                          Review and approve
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-400">Recently decided</h2>
          {closed.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing decided yet.</p>
          ) : (
            <Card>
              <ul className="divide-y divide-ink-700">
                {closed.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-16 shrink-0 text-xs text-ink-400">
                      {r.reviewed_at ? timeAgo(r.reviewed_at) : "—"}
                    </span>
                    <Link to={`/review/${r.id}`} className="min-w-0 flex-1 rounded text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                      {r.patient?.display_name ?? (r.patient?.bed ? `Bed ${r.patient.bed}` : "Patient")} · {CONDITIONS[r.condition]}
                    </Link>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        r.status === "approved"
                          ? "bg-calm/15 text-calm"
                          : "bg-ink-700 text-ink-400"
                      }`}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

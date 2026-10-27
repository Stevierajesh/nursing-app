import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { QueuedEscalation } from "../lib/mobileTypes";
import { REASON_LABELS, WORRY_LABELS, type WorryLevel } from "../lib/types";
import { Button, Card, ErrorNote, Spinner, timeAgo } from "./Primitives";

/*
 * The prescriber's deterioration queue.
 *
 * Until this existed, a worry escalation reached the charge nurse's board and
 * stopped there: the only thing that ever reached a physician was a medication
 * request. So the product's central claim -- nurse concern and vitals agreeing
 * gets the right doctor involved -- had no doctor at the end of it.
 *
 * What lands here is decided server-side by `reaches_physician()`, not by this
 * component, so the rule cannot drift between the queue and the authorization
 * check that lets a prescriber answer it.
 *
 * There is no "responsible physician" to route to: no patient-to-prescriber
 * assignment exists in the schema. The queue therefore goes to every
 * prescriber in the org, which is the same widening the second level of the
 * medication escalation already uses. Inventing an assignment table to name
 * one doctor would be a bigger lie than showing it to all of them.
 */

const POLL_MS = 15000;

export default function DoctorEscalations() {
  const [rows, setRows] = useState<QueuedEscalation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { escalations } = await api.get<{ escalations: QueuedEscalation[] }>(
        "/api/v1/dashboard/escalations",
      );
      // Unanswered first, then oldest first within each group: the thing that
      // has been waiting longest without a response is the thing to open.
      const open = escalations.filter((e) => !e.acknowledged_at);
      const seen = escalations.filter((e) => e.acknowledged_at);
      const byAge = (a: QueuedEscalation, b: QueuedEscalation) =>
        a.triggered_at.localeCompare(b.triggered_at);
      setRows([...open.sort(byAge), ...seen.sort(byAge)]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the deterioration queue.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function act(id: string, action: "acknowledge" | "assess") {
    setBusyId(id);
    setError(null);
    try {
      await api.post(
        `/api/v1/escalations/${id}/${action}`,
        action === "assess" ? { note: "Reviewed by prescriber" } : {},
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your response.");
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) return <Spinner />;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-400">
          Deterioration escalations · {rows.filter((e) => !e.acknowledged_at).length} waiting
        </h2>
        <p className="text-[11px] text-ink-400">Refreshes every 15s</p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {rows.length === 0 ? (
        <Card className="rounded-3xl">
          <p className="text-sm text-ink-400">
            Nothing has been escalated to a physician. Escalations on vitals alone stay
            with the nursing tier.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => {
            const overdue = e.status === "auto_escalated" && !e.acknowledged_at;
            const worry = e.worry_signal;
            const level = worry ? (worry.level as WorryLevel) : null;
            return (
              <li key={e.id}>
                <Card
                  className={`rounded-3xl ${overdue ? "border-very/40 bg-very/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">
                        {e.patient?.room ? `Room ${e.patient.room} · ` : ""}
                        {e.patient?.display_name ?? "Patient"}
                      </h3>
                      <p className="mt-1 text-xs text-ink-400">
                        {e.rule_label ?? e.rule} · escalated {timeAgo(e.triggered_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        overdue
                          ? "bg-very/15 text-very"
                          : e.acknowledged_at
                            ? "bg-calm/15 text-calm"
                            : "bg-slight/15 text-slight"
                      }`}
                    >
                      {overdue
                        ? "Nursing tier did not respond"
                        : e.acknowledged_at
                          ? "You acknowledged"
                          : "Waiting"}
                    </span>
                  </div>

                  {/* The nurse's own words. A bare score tells a physician
                      nothing they could not read off the chart themselves. */}
                  {worry && (
                    <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
                        {worry.nurse?.full_name ?? "Nurse"} ·{" "}
                        {level !== null ? WORRY_LABELS[level] : "Concern recorded"}
                      </p>
                      {worry.reasons.length > 0 && (
                        <p className="mt-2 text-sm">
                          {worry.reasons.map((r) => REASON_LABELS[r] ?? r).join(" · ")}
                        </p>
                      )}
                      {worry.note && <p className="mt-1 text-sm italic">“{worry.note}”</p>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!e.acknowledged_at && (
                      <Button
                        className="rounded-full! px-4 text-xs"
                        disabled={busyId === e.id}
                        onClick={() => void act(e.id, "acknowledge")}
                      >
                        {busyId === e.id ? "Saving…" : "Acknowledge"}
                      </Button>
                    )}
                    {!e.assessed_at && (
                      <Button
                        variant="ghost"
                        className="rounded-full! px-4 text-xs"
                        disabled={busyId === e.id}
                        onClick={() => void act(e.id, "assess")}
                      >
                        Mark reviewed
                      </Button>
                    )}
                    <Link
                      to={`/respond/${e.patient_id}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-accent/40 px-4 text-xs font-semibold text-accent"
                    >
                      Open patient
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

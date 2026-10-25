import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import type { Patient } from "../lib/types";
import { Button, ErrorNote } from "./Primitives";

export default function EscalationActions({ patient, compact = false }: { patient: Patient; compact?: boolean }) {
  const { me } = useAuth();
  const { refresh } = usePatients();
  const [busy, setBusy] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const escalation = patient.open_escalation;
  if (!escalation || me?.user.role === "prescriber") return null;
  async function act(action: "acknowledge" | "assess") {
    if (!escalation || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/api/v1/escalations/${escalation.id}/${action}`,
        action === "assess" ? { note: note.trim() || null } : {},
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record response");
    } finally {
      setBusy(false);
    }
  }
  /*
   * An overdue escalation is the mockups' CRITICAL card -- pink fill, red edge,
   * red badge -- and everything still waiting is the softer amber. One amber
   * treatment for all three states made "nobody has answered this" look the
   * same as "seen, assessment pending".
   *
   * Acknowledgement clears the red even while the row is still
   * `auto_escalated`: red has to mean "needs someone now", or it stops
   * agreeing with the Alerts filter count and stops being worth looking at.
   */
  const overdue =
    escalation.status === "auto_escalated" && !escalation.acknowledged_at;
  const label = escalation.acknowledged_at
    ? "Acknowledged · assessment pending"
    : escalation.status === "auto_escalated"
      ? "Overdue escalation"
      : "Awaiting response";

  if (compact) return <div className="mt-4 space-y-3">
    {error && <ErrorNote>{error}</ErrorNote>}
    <div className="grid grid-cols-2 gap-2">
      {!escalation.acknowledged_at ? <>
        <Button className="rounded-full! px-3 text-xs" disabled={busy} onClick={() => void act("acknowledge")}>{busy ? "Saving…" : "Acknowledge"}</Button>
        <Button variant="ghost" className="rounded-full! px-3 text-xs" disabled={busy} aria-expanded={assessing} onClick={() => setAssessing(!assessing)}>Record assessment</Button>
      </> : <Button className="col-span-2 rounded-full! px-3 text-xs" disabled={busy} aria-expanded={assessing} onClick={() => setAssessing(!assessing)}>Record assessment</Button>}
    </div>
    {assessing && <div className="space-y-3 rounded-2xl border border-ink-600/60 bg-white/70 p-3">
      <label className="block text-xs font-medium text-ink-400">Assessment note (optional)
        <textarea aria-label={`Assessment note for ${patient.display_name}`} value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={2} className="mt-2 w-full rounded-xl border border-ink-600 bg-white p-3 text-sm" />
      </label>
      <Button disabled={busy} className="w-full rounded-full! text-xs" onClick={() => void act("assess")}>{busy ? "Saving…" : "Mark assessed"}</Button>
    </div>}
  </div>;

  return (
    <div
      className={`space-y-3 rounded-2xl border p-4 ${overdue ? "border-very/40 bg-very/5" : "border-slight/40 bg-ink-800"}`}
    >
      <p>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${overdue ? "bg-very/15 text-very" : "bg-slight/15 text-slight"}`}
        >
          {label}
        </span>
      </p>
      <p className="text-xs text-ink-400">
        Acknowledge when you have seen the alert. Mark assessed after checking
        the patient.
      </p>
      <label className="block text-sm text-ink-200">
        Assessment note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={2}
          className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-900 p-3"
        />
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap gap-2">
        {!escalation.acknowledged_at && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void act("acknowledge")}
          >
            Acknowledge
          </Button>
        )}
        <Button disabled={busy} onClick={() => void act("assess")}>
          {busy ? "Saving…" : "Mark assessed"}
        </Button>
      </div>
    </div>
  );
}

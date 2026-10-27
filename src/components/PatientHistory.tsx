import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Patient } from "../lib/types";
import { Button, Card, ErrorNote } from "./Primitives";

/*
 * The four history fields behind approval-review section 5.
 *
 * The columns have existed since the doctor-mode migration; nothing could
 * write them, so the section rendered "Not recorded" four times for every
 * patient. This is the write path.
 *
 * Three states, kept distinct end to end -- the same discipline as allergies,
 * and for the same reason. `null` means nobody has asked, and it renders amber
 * rather than blank: a prescriber reading an empty history line as "nothing of
 * note" is the misread that matters here. Clearing a field sends an explicit
 * null; untouched fields are not sent at all, so saving one does not wipe the
 * others.
 */

const FIELDS = [
  ["past_history", "Past history", "Chronic conditions and relevant history."],
  ["home_medications", "Home medications", "What they take at home. Not a reconciled list."],
  ["prior_admissions", "Prior admissions", "Previous admissions relevant to this one."],
  ["past_responses", "Past responses", "How this patient responded to previous treatment."],
] as const;

type FieldKey = (typeof FIELDS)[number][0];

export default function PatientHistory({
  patient,
  onSaved,
}: {
  patient: Patient;
  onSaved: () => void;
}) {
  const { me } = useAuth();
  const canEdit = me?.user.role !== "prescriber";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<FieldKey, string>>(() => ({
    past_history: patient.past_history ?? "",
    home_medications: patient.home_medications ?? "",
    prior_admissions: patient.prior_admissions ?? "",
    past_responses: patient.past_responses ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorded = FIELDS.filter(([key]) => patient[key]).length;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Only changed fields go up, and a cleared field goes up as null so the
      // server records "not recorded" rather than an empty string.
      const payload: Record<string, string | null> = {};
      for (const [key] of FIELDS) {
        const next = draft[key].trim();
        const current = patient[key] ?? "";
        if (next !== current) payload[key] = next || null;
      }
      if (Object.keys(payload).length === 0) {
        setEditing(false);
        return;
      }
      await api.patch(`/api/v1/patients/${patient.id}/history`, payload);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the history.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">History</h3>
        <span className="text-xs text-ink-400">{recorded}/4 recorded</span>
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-3">
          <fieldset disabled={busy} className="space-y-3">
            {FIELDS.map(([key, label, hint]) => (
              <label key={key} className="block text-xs font-medium text-ink-400">
                {label}
                <textarea
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  maxLength={4000}
                  rows={2}
                  placeholder={hint}
                  className="mt-1 w-full rounded-xl border border-ink-600 bg-white p-3 text-sm text-ink-200"
                />
              </label>
            ))}
            <p className="text-[11px] leading-relaxed text-ink-400">
              Leave a field empty if nobody has taken it. An empty field reads as
              “not recorded”, which is not the same as “nothing to report”.
            </p>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 rounded-full! text-xs">
                {busy ? "Saving…" : "Save history"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full! text-xs"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <dl className="mt-3 space-y-3 divide-y divide-ink-600/60 [&>div:not(:first-child)]:pt-3">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <dt className="text-xs text-ink-400">{label}</dt>
                <dd
                  className={`mt-1 text-sm ${patient[key] ? "" : "font-semibold text-slight"}`}
                >
                  {patient[key] || "Not recorded"}
                </dd>
              </div>
            ))}
          </dl>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              className="mt-4 w-full rounded-full! text-xs"
              onClick={() => setEditing(true)}
            >
              {recorded === 0 ? "Record history" : "Edit history"}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

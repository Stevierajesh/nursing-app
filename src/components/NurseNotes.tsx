import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { NurseNote } from "../lib/types";
import { Button, Card, ErrorNote, timeAgo } from "./Primitives";

/*
 * Charting a nurse note, and reading the ones already charted.
 *
 * `nurse_notes` and its API endpoint both existed before this; what did not
 * exist was any way to write one from the app. So section 4 of the approval
 * review -- "Nurse notes" -- rendered "No nurse notes recorded" for every
 * patient in the system, which is correct behaviour and a useless section. A
 * physician ticking "I have read the nursing notes" was ticking an empty box.
 *
 * Prescribers get the list and no composer. Section 4 is what the ward
 * observed; a doctor writing into it would make the one section carrying
 * bedside judgement a record of the reader's own assumptions instead. The API
 * enforces this too -- the role is not accepted on the endpoint.
 */

const MAX = 4000;

export default function NurseNotes({
  patientId,
  notes,
  onCharted,
}: {
  patientId: string;
  notes: NurseNote[];
  onCharted: () => void;
}) {
  const { me } = useAuth();
  const canChart = me?.user.role !== "prescriber";
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/patients/${patientId}/notes`, { body: body.trim() });
      setBody("");
      onCharted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not chart the note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Nurse notes</h3>
        <span className="text-xs text-ink-400">
          {notes.length === 0 ? "None recorded" : `${notes.length} recorded`}
        </span>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-3">
          {notes.slice(0, 5).map((note) => (
            <li key={note.id} className="rounded-2xl border border-ink-600/60 bg-ink-800 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink-400">{timeAgo(note.recorded_at)}</span>
                <span className="text-[11px] font-semibold text-ink-400">
                  {note.author?.full_name ?? "Nurse"}
                </span>
              </div>
              <p className="mt-1 text-sm">{note.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canChart ? (
        <form onSubmit={submit} className="mt-4">
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-xs font-medium text-ink-400">
              Chart a note
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={MAX}
                rows={3}
                placeholder="What you observed, in your own words."
                className="mt-2 w-full rounded-xl border border-ink-600 bg-white p-3 text-sm"
              />
            </label>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-ink-400">
                {body.length}/{MAX}
              </span>
              <Button type="submit" className="rounded-full! px-4 text-xs" disabled={!body.trim()}>
                {busy ? "Charting…" : "Chart note"}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        notes.length === 0 && (
          <p className="mt-3 text-sm text-slight">
            Nothing charted for this patient yet.
          </p>
        )
      )}
    </Card>
  );
}

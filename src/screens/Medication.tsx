import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { patientLocation, sortPatients } from "../lib/patientOrder";
import {
  CONDITIONS,
  UNREVIEWED_PREFIX,
  type MedicationClass,
  type MedicationReview,
  type Prescriber,
  type ReviewCondition,
} from "../lib/mobileTypes";
import type { Vitals } from "../lib/types";
import {
  Button,
  Card,
  ErrorNote,
  Spinner,
  timeAgo,
} from "../components/Primitives";

function reading(
  v: Partial<Vitals> | null | undefined,
  condition: ReviewCondition,
): string {
  if (condition === "blood_pressure")
    return v?.systolic_bp != null && v.diastolic_bp != null
      ? `${v.systolic_bp}/${v.diastolic_bp} mmHg`
      : "No blood pressure recorded";
  if (condition === "blood_sugar")
    return v?.glucose_mg_dl != null
      ? `${v.glucose_mg_dl} mg/dL`
      : "No blood sugar recorded";
  return v?.heart_rate != null
    ? `${v.heart_rate} bpm`
    : "No heart rate recorded";
}

export default function Medication() {
  const { me } = useAuth();
  const {
    patients,
    loading: patientsLoading,
    error: patientsError,
  } = usePatients();
  const [reviews, setReviews] = useState<MedicationReview[]>([]);
  const [prescribers, setPrescribers] = useState<Prescriber[]>([]);
  const [classes, setClasses] = useState<MedicationClass[]>([]);
  const [condition, setCondition] = useState<ReviewCondition>("blood_pressure");
  const [classId, setClassId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [prescriberId, setPrescriberId] = useState("");
  const [note, setNote] = useState("");
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isPrescriber = me?.user.role === "prescriber";
  const load = useCallback(async () => {
    try {
      const [r, p, c] = await Promise.all([
        api.get<{ reviews: MedicationReview[] }>("/api/v1/medication/reviews"),
        api.get<{ prescribers: Prescriber[] }>(
          "/api/v1/medication/prescribers",
        ),
        api.get<{ classes: MedicationClass[] }>("/api/v1/medication/classes"),
      ]);
      setReviews(r.reviews);
      setPrescribers(p.prescribers);
      setClasses(c.classes);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load medication reviews",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  const patient =
    patients.find((p) => p.id === patientId) ??
    sortPatients(patients, "risk")[0];
  const recipient =
    prescribers.find((p) => p.id === prescriberId) ?? prescribers[0];
  const conditionClasses = classes.filter((c) => c.condition === condition);
  const unreviewedVocabulary = conditionClasses.some((c) =>
    (c.source ?? "").startsWith(UNREVIEWED_PREFIX),
  );
  async function send() {
    if (!patient || !recipient || !note.trim() || busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.post("/api/v1/medication/reviews", {
        patient_id: patient.id,
        prescriber_id: recipient.id,
        condition,
        request_note: note.trim(),
        suggested_class_id: classId || null,
      });
      setNote("");
      setClassId("");
      await load();
      setMessage(`Review request sent to ${recipient.full_name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  }
  async function act(id: string, action: "review" | "dismiss") {
    const response = responseNotes[id]?.trim();
    if (!response || busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.patch(`/api/v1/medication/reviews/${id}`, {
        action,
        note: response,
      });
      await load();
      setMessage(
        action === "review"
          ? "Physician review recorded."
          : "Request dismissed.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update review");
    } finally {
      setBusy(false);
    }
  }
  if (loading || patientsLoading)
    return <Spinner label="Loading medication review" />;
  return (
    <div className="space-y-5 p-4">
      <h1 className="text-4xl font-extrabold tracking-tight">Medication</h1>
      <p className="text-sm text-ink-400">
        {isPrescriber
          ? "Your physician review queue"
          : "Request a medication review from a physician"}
      </p>
      {(error || patientsError) && (
        <ErrorNote>{error || patientsError}</ErrorNote>
      )}
      {message && (
        <p role="status" className="text-sm text-calm">
          {message}
        </p>
      )}
      {/* Two columns only when there is a request form to put beside the queue.
          A physician has no form, so their queue keeps the full width. */}
      <div
        className={
          isPrescriber
            ? "space-y-5"
            : "space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
        }
      >
        <div className="space-y-5">
          {!isPrescriber && (
            <>
              <div
                role="group"
                aria-label="Review condition"
                className="grid grid-cols-3 gap-2"
              >
                {(Object.keys(CONDITIONS) as ReviewCondition[]).map((c) => (
                  <button
                    key={c}
                    aria-pressed={c === condition}
                    onClick={() => {
                      setCondition(c);
                      // The vocabulary is per-condition, so a class chosen for
                      // the old one would be rejected by the API's pairing check.
                      setClassId("");
                      setMessage("");
                    }}
                    className={`min-h-14 rounded-full border px-2 text-sm font-semibold transition ${condition === c ? "border-accent bg-accent text-white" : "border-ink-600 bg-ink-800 text-ink-200"}`}
                  >
                    {CONDITIONS[c]}
                  </button>
                ))}
              </div>
              <Card className="space-y-4">
                <h2 className="font-semibold">For physician review</h2>
                {patients.length === 0 ? (
                  <p>No patients on your active list.</p>
                ) : (
                  <>
                    <label className="block text-sm">
                      Patient
                      <select
                        aria-label="Medication patient"
                        value={patient?.id ?? ""}
                        onChange={(e) => {
                          setPatientId(e.target.value);
                          setNote("");
                        }}
                        className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3"
                      >
                        {sortPatients(patients, "risk").map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.display_name} · {patientLocation(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-xl bg-ink-900 p-3">
                      <p className="font-semibold">
                        {reading(patient?.latest_vitals, condition)}
                      </p>
                      <p className="mt-1 text-xs text-ink-400">
                        {patient?.latest_vitals
                          ? `Recorded ${timeAgo(patient.latest_vitals.recorded_at)}`
                          : "A review request can still be sent with your observations."}
                      </p>
                    </div>
                    {/* The nurse suggests a class; the app does not recommend
                        one. Optional, and deselectable -- a request that just
                        says "look at this" is still worth sending. */}
                    {conditionClasses.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
                          Suggested class{" "}
                          <span className="font-normal normal-case text-ink-400">
                            optional
                          </span>
                        </h3>
                        <div
                          role="group"
                          aria-label="Suggested medication class"
                          className="flex flex-wrap gap-2"
                        >
                          {conditionClasses.map((c) => {
                            const on = classId === c.id;
                            return (
                              <button
                                key={c.id}
                                onClick={() => setClassId(on ? "" : c.id)}
                                aria-pressed={on}
                                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${
                                  on
                                    ? "border-accent bg-accent text-white"
                                    : "border-ink-600 bg-ink-800 text-ink-200"
                                }`}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                        {unreviewedVocabulary && (
                          <p className="mt-2 text-xs leading-relaxed text-slight">
                            This list has not been clinically reviewed for this
                            unit. A physician decides the medication.
                          </p>
                        )}
                      </div>
                    )}
                    <label className="block text-sm">
                      Physician
                      <select
                        aria-label="Physician"
                        value={recipient?.id ?? ""}
                        onChange={(e) => setPrescriberId(e.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3"
                      >
                        {prescribers.length === 0 ? (
                          <option value="">No physician configured</option>
                        ) : (
                          prescribers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                    {prescribers.length === 0 && (
                      <p className="text-xs text-slight">
                        An administrator must configure a physician account
                        before requests can be sent.
                      </p>
                    )}
                    <label className="block text-sm">
                      Reason for review
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={2000}
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-900 p-3"
                        placeholder="Describe your concern and the medication question."
                      />
                    </label>
                    <Button
                      disabled={busy || !recipient || !note.trim()}
                      onClick={() => void send()}
                      className="w-full"
                    >
                      {busy ? "Saving…" : "Send to physician"}
                    </Button>
                  </>
                )}
              </Card>
            </>
          )}
          <p className="text-xs leading-5 text-ink-400">
            Review requests are delivered to the physician’s in-app queue. A
            recorded review is not a medication order.
          </p>
        </div>
        <section aria-label="Medication review requests" className="space-y-3">
          <h2 className="text-lg font-semibold">
            {isPrescriber ? "Requests assigned to you" : "Review requests"}
          </h2>
          {reviews.length === 0 && <Card>No medication review requests.</Card>}
          {reviews.map((r) => {
            const p = patients.find((p) => p.id === r.patient_id);
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">
                    {p?.display_name ??
                      r.patient?.display_name ??
                      "Patient review"}
                  </h3>
                  {/* Dismissed must not share the green the mockups use for an
                      approved review -- on a pale badge the colour is the whole
                      signal, and "dismissed in green" reads as "actioned". */}
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${r.status === "pending" ? "bg-slight/15 text-slight" : r.status === "reviewed" ? "bg-calm/15 text-calm" : "bg-ink-700 text-ink-400"}`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-ink-200">
                  {CONDITIONS[r.condition]} ·{" "}
                  {reading(r.vitals_snapshot, r.condition)}
                </p>
                {r.suggested_class && (
                  // Attributed to the nurse, not the system -- the same list
                  // under "options often considered" would read as advice.
                  <p className="text-sm">
                    <span className="text-ink-400">Nurse suggested: </span>
                    <span className="font-semibold">
                      {r.suggested_class.label}
                    </span>
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">
                  {r.request_note}
                </p>
                <p className="text-xs text-ink-400">
                  To{" "}
                  {prescribers.find((p) => p.id === r.prescriber_id)?.full_name ??
                    "assigned physician"}{" "}
                  · {timeAgo(r.created_at)}
                </p>
                {r.review_note && (
                  <div className="rounded-xl bg-ink-900 p-3 text-sm">
                    <p className="mb-1 text-xs text-ink-400">
                      {r.status === "reviewed"
                        ? "Physician response"
                        : "Dismissal reason"}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {r.review_note}
                    </p>
                  </div>
                )}
                {r.status === "pending" && (
                  <>
                    <label className="block text-sm">
                      {isPrescriber ? "Review response" : "Dismissal reason"}
                      <textarea
                        value={responseNotes[r.id] ?? ""}
                        onChange={(e) =>
                          setResponseNotes((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        maxLength={2000}
                        rows={2}
                        className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-900 p-3"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {isPrescriber && (
                        <Button
                          disabled={busy || !responseNotes[r.id]?.trim()}
                          onClick={() => void act(r.id, "review")}
                        >
                          Complete review
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={busy || !responseNotes[r.id]?.trim()}
                        onClick={() => void act(r.id, "dismiss")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </section>
      </div>
    </div>
  );
}

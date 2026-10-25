import DoctorAlerts from "./DoctorAlerts";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { patientLocation, sortPatients } from "../lib/patientOrder";
import { patientPriority, riskBand, riskOutOfTen } from "../lib/risk";
import { CONDITIONS, UNREVIEWED_PREFIX, type MedicationClass, type Prescriber, type ReviewCondition } from "../lib/mobileTypes";
import type { Vitals, Patient } from "../lib/types";
import { Button, Card, ErrorNote, Spinner, timeAgo } from "../components/Primitives";

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

export default function Medication({ nurseView = false }: { nurseView?: boolean }) {
  const { me } = useAuth();
  return me?.user.role === "prescriber" && !nurseView ? <DoctorAlerts /> : <NurseMedication />;
}

const INPUT = "mt-1 min-h-11 w-full rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-sm";

function NurseMedication() {
  const { me } = useAuth();
  const canRequest = me?.user.role !== "prescriber";
  const { patients, loading: patientsLoading, error: patientsError } = usePatients();
  const [condition, setCondition] = useState<ReviewCondition>("blood_pressure");
  const [prescribers, setPrescribers] = useState<Prescriber[]>([]);
  const [classes, setClasses] = useState<MedicationClass[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api.get<{ prescribers: Prescriber[] }>("/api/v1/medication/prescribers"),
        api.get<{ classes: MedicationClass[] }>("/api/v1/medication/classes"),
      ]);
      setPrescribers(p.prescribers); setClasses(c.classes); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load medication options"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  const keyFor = (p: Patient) => `${condition}:${p.id}:${p.latest_vitals?.id ?? "none"}`;
  const visible = sortPatients(patients, "risk").filter(p => !dismissed.includes(keyFor(p)));
  if (loading || patientsLoading) return <Spinner label="Loading medication patients" />;
  return <div className="space-y-5 p-4">
    <p className="text-sm text-ink-400">Patient readings by condition</p>
    {(error || patientsError) && <ErrorNote>{error || patientsError}</ErrorNote>}
    <div role="group" aria-label="Medication condition" className="flex flex-wrap gap-2">
      {(Object.keys(CONDITIONS) as ReviewCondition[]).map(c => <button key={c} type="button" aria-pressed={condition === c} onClick={() => setCondition(c)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${condition === c ? "border-accent bg-accent text-white" : "border-ink-600 bg-transparent text-ink-400 hover:border-accent"}`}>{CONDITIONS[c]}</button>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-ink-400">{CONDITIONS[condition]} · {visible.length} patient{visible.length === 1 ? "" : "s"}</h2>
      {dismissed.length > 0 && <button type="button" onClick={() => setDismissed([])} className="min-h-11 text-xs font-semibold text-accent">Show dismissed patients</button>}
    </div>
    {!visible.length && <Card>{patients.length ? "No patients to show for this view." : "No patients on your active list."}</Card>}
    <div className="grid items-start gap-4 md:grid-cols-2">
      {visible.map(patient => <MedicationPatientCard key={`${condition}:${patient.id}`} patient={patient} condition={condition} canRequest={canRequest} classes={classes.filter(c => c.condition === condition)} prescribers={prescribers} sentTo={sent[`${condition}:${patient.id}`]} onSent={name => setSent(previous => ({ ...previous, [`${condition}:${patient.id}`]: name }))} onDismiss={() => setDismissed(previous => [...previous, keyFor(patient)])} />)}
    </div>
    <p className="text-xs leading-5 text-ink-400">For prescriber review. A prescriber decides treatment; sending a concern does not place a medication order.</p>
  </div>;
}

function MedicationPatientCard({ patient, condition, canRequest, classes, prescribers, sentTo, onSent, onDismiss }: {
  patient: Patient;
  condition: ReviewCondition;
  classes: MedicationClass[];
  canRequest: boolean;
  prescribers: Prescriber[];
  sentTo?: string;
  onSent: (name: string) => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [prescriberId, setPrescriberId] = useState("");
  const [classId, setClassId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recipient = prescribers.find(p => p.id === prescriberId) ?? prescribers[0];
  const score = riskOutOfTen(patient.risk_score);
  const band = riskBand(patient.risk_score);
  const priority = patientPriority(patient);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || !canRequest || !recipient || !note.trim()) return;
    setBusy(true); setError("");
    try {
      await api.post("/api/v1/medication/reviews", { patient_id: patient.id, prescriber_id: recipient.id, condition, request_note: note.trim(), suggested_class_id: classId || null });
      onSent(recipient.full_name); setExpanded(false); setNote(""); setClassId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send concern"); }
    finally { setBusy(false); }
  }
  return <Card className="rounded-3xl">
    <div className="flex items-start gap-3">
      <div className={`w-11 shrink-0 text-center ${band.text}`} aria-label={`Combined risk ${score} out of 10`}>
        <div className="flex h-7 items-end justify-center gap-0.5" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index} className={`w-0.5 rounded-t-sm ${index < score ? "bg-current" : "bg-ink-600"}`} style={{ height: `${6 + index * 2}px` }} />)}</div>
        <span aria-hidden="true" className="mt-1 block text-[11px] font-bold">{score}/10</span>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{patient.bed ? `Bed ${patient.bed}` : patient.display_name} · {reading(patient.latest_vitals, condition)}</h3>
        <p className="mt-1 text-xs text-ink-400">{patient.bed ? `${patient.display_name} · ` : ""}{patientLocation(patient)}</p>
        <p className={`mt-1 text-xs ${priority.band.text}`}>Risk {score}/10 · {priority.label}</p>
      </div>
    </div>
    <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-accent">For prescriber review</p>
      <p className="mt-2 text-sm">{CONDITIONS[condition]}: {reading(patient.latest_vitals, condition)}</p>
      <p className="mt-1 text-xs leading-5 text-ink-400">{patient.latest_vitals ? `Observed ${timeAgo(patient.latest_vitals.recorded_at)}. ` : ""}Send your concern and optionally suggest a medication class for the prescriber to review.</p>
    </div>
    {sentTo && <p role="status" className="mt-3 text-xs font-medium text-calm">Concern sent to {sentTo}.</p>}
    {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    {expanded ? <form onSubmit={send} className="mt-4">
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Prescriber<select required value={recipient?.id ?? ""} onChange={e => setPrescriberId(e.target.value)} className={INPUT}>{!prescribers.length && <option value="">No prescriber configured</option>}{prescribers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
        {classes.length > 0 && <label className="block text-sm">Suggested class (optional)<select value={classId} onChange={e => setClassId(e.target.value)} className={INPUT}><option value="">No class suggested</option>{classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
        {classes.some(c => (c.source ?? "").startsWith(UNREVIEWED_PREFIX)) && <p className="text-xs text-slight">This class list has not been clinically reviewed for this unit. The prescriber decides treatment.</p>}
        <label className="block text-sm">Your concern<textarea required maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Describe your concern and medication question." className={INPUT} /></label>
        <div className="flex gap-2"><Button type="submit" className="flex-1 rounded-full" disabled={!recipient || !note.trim()}>{busy ? "Sending…" : "Send to prescriber"}</Button><Button type="button" variant="ghost" className="rounded-full" onClick={() => setExpanded(false)}>Cancel</Button></div>
      </fieldset>
    </form> : <div className="mt-3 flex gap-2">
      <Button type="button" className="flex-1 rounded-full" disabled={!canRequest || !prescribers.length} onClick={() => setExpanded(true)}>Send to prescriber</Button>
      <Button type="button" variant="ghost" className="rounded-full" onClick={onDismiss}>Dismiss</Button>
    </div>}
    {!prescribers.length && <p className="mt-2 text-xs text-slight">An administrator needs to add a prescriber before concerns can be sent.</p>}
  </Card>;
}

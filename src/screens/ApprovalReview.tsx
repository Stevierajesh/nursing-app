import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Card, ErrorNote, Spinner, timeAgo } from "../components/Primitives";
import RiskHistoryChart from "../components/RiskHistoryChart";
import Sparkline from "../components/Sparkline";
import { detailPriority, riskOutOfTen } from "../lib/risk";
import { CONDITIONS, UNREVIEWED_PREFIX } from "../lib/mobileTypes";
import type { MedicationReview, PrescriptionDraft } from "../lib/mobileTypes";
import { WORRY_LABELS } from "../lib/types";
import type { PatientDetail, VitalBands, Vitals } from "../lib/types";

// Eight reviewed sections precede the doctor's recorded prescription decision.
const SECTIONS = [
  "Patient details",
  "Risk and deterioration",
  "Vitals and charts",
  "Nurse notes",
  "History",
  "Treatment progress",
  "Nurse recommendation",
  "Your prescription",
] as const;

const BAND_STYLES: Record<string, string> = {
  watch: "text-slight",
  elevated: "text-worried",
  high: "text-very",
};

/*
 * Trend lines are tinted neutral when the band is normal or absent, where the
 * mockup uses green. Green is a positive claim -- "this is fine" -- and for
 * blood pressure NEWS2 cannot make it: 168/102 scores zero, so a green line
 * would reassure about the one reading on this screen that should not.
 * Neutral says "nothing flagged" and leaves the number to speak.
 */
const TREND_STYLES: Record<string, string> = { ...BAND_STYLES, normal: "text-ink-600" };

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** Not recorded and "none" are different facts; only one of them is reassuring. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
      {value ? (
        <p className="mt-0.5 text-sm font-semibold">{value}</p>
      ) : (
        <p className="mt-0.5 text-sm font-semibold text-slight">Not recorded</p>
      )}
    </div>
  );
}

function Section({
  index,
  title,
  checked,
  onToggle,
  children,
  bare = false,
  accent = false,
}: {
  bare?: boolean;
  accent?: boolean;
  index: number;
  title: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-semibold text-ink-400">
        {index + 1} · {title}
      </h2>
      {bare ? children : <Card className={`rounded-3xl ${accent ? "border-accent/50" : ""}`}>{children}</Card>}
      <button
        onClick={onToggle}
        aria-pressed={checked}
        className={`mt-2 flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-sm font-semibold transition ${
          checked
            ? "border-accent bg-accent/10 text-accent"
            : "border-ink-700 bg-transparent text-ink-200 hover:border-ink-600"
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
            checked ? "border-accent bg-accent text-white" : "border-ink-600"
          }`}
          aria-hidden
        >
          {checked ? "✓" : ""}
        </span>
        I have reviewed this section
      </button>
    </section>
  );
}

function VitalCard({
  label,
  value,
  unit,
  band,
  series,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  band?: VitalBands[string];
  series: (number | null)[];
}) {
  // No badge when the value sits in the normal band. A "Normal" chip would
  // read as an all-clear, and for blood pressure NEWS2 cannot give one: it
  // scores only hypotension, so a hypertensive reading scores zero.
  const show = band && band.label !== "normal";
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-ink-400">{label}</p>
        {show && (
          <span className={`text-[11px] font-bold ${BAND_STYLES[band.label] ?? "text-ink-400"}`}>
            {band.direction === "low" ? "Low" : band.label === "watch" ? "Watch" : band.label === "elevated" ? "Elevated" : "High"}
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">
        {value ?? "—"}
        <span className="ml-1 text-xs font-semibold text-ink-400">{unit}</span>
      </p>
      <Sparkline
        values={series}
        label={`${label} trend over the last 8 hours`}
        className={TREND_STYLES[band?.label ?? "normal"] ?? "text-ink-600"}
      />
    </div>
  );
}

export default function ApprovalReview() {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<MedicationReview | null>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [ticked, setTicked] = useState<boolean[]>(() => SECTIONS.map(() => false));
  const [note, setNote] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([blankPrescription()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { reviews } = await api.get<{ reviews: MedicationReview[] }>(
          "/api/v1/medication/reviews",
        );
        const found = reviews.find((r) => r.id === reviewId) ?? null;
        if (!live) return;
        setReview(found);
        setTicked(SECTIONS.map((_, index) => found?.reviewed_sections?.includes(index) ?? false));
        setPrescriptions(found?.prescriptions?.length ? found.prescriptions : [blankPrescription()]);
        setNote(found?.decision_note ?? "");
        if (found) {
          const d = await api.get<PatientDetail>(`/api/v1/patients/${found.patient_id}`);
          if (live) setDetail(d);
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not load this request.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [reviewId]);

  const allTicked = ticked.every(Boolean);
  const tickedCount = ticked.filter(Boolean).length;
  const bands = detail?.vital_bands ?? {};
  const latest = useMemo(
    () => (detail?.vitals.length ? detail.vitals[detail.vitals.length - 1] : null),
    [detail],
  );

  /*
   * vitals arrive oldest-first, so the slice is already in drawing order.
   *
   * The doc specifies an 8-hour window, but a patient whose last observation
   * is older than that would get six blank cards. Rather than silently widen
   * the window -- which would let a stale line pass as current -- fall back to
   * the most recent readings and say so in the caption underneath.
   */
  const { trend, windowLabel } = useMemo(() => {
    const vitals = detail?.vitals ?? [];
    const cutoff = openedAt - EIGHT_HOURS_MS;
    const recent = vitals.filter((v) => new Date(v.recorded_at).getTime() >= cutoff);
    const fresh = recent.length >= 2;
    const window = fresh ? recent : vitals.slice(-12);
    const oldest = window[0];
    return {
      trend: (key: keyof Vitals) => window.map((v) => v[key] as number | null),
      windowLabel: fresh
        ? "Trend lines cover the last 8 hours."
        : window.length >= 2
          ? `No observations in the last 8 hours. Trend lines show the most recent ${window.length}, oldest ${timeAgo(oldest.recorded_at)}.`
          : "Not enough observations charted to draw a trend.",
    };
  }, [detail, openedAt]);

  async function decide(action: "approve" | "reject") {
    if (!review || busy || !allTicked || !detail || !["pending", "escalated"].includes(review.status)) return;
    if (action === "approve" && !prescriptionsValid) {
      setError("Complete medication, dose, route, frequency, and duration for each prescription.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/v1/medication/reviews/${review.id}`, {
        action,
        note: note.trim() || (action === "approve" ? "Prescription approved after full review" : "Declined after full review"),
        ...(action === "approve" ? { prescriptions, reviewed_sections: ticked.map((_, index) => index) } : {}),
      });
      navigate("/alerts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your decision.");
      setBusy(false);
    }
  }

  /*
   * Deliberately not gated on the section ticks. The ticks certify that you
   * read the record before *deciding*; asking the nurse a question is what you
   * do when the record is not enough to decide on, so requiring a full read
   * first would be backwards.
   */
  async function requestInfo() {
    if (!review || busy || !["pending", "escalated"].includes(review.status)) return;
    const question = note.trim();
    if (!question) {
      setError("Write what you need from the nurse before sending.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { review: updated } = await api.patch<{ review: MedicationReview }>(
        `/api/v1/medication/reviews/${review.id}`,
        { action: "request_info", note: question },
      );
      setReview(updated);
      setNote("");
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your question.");
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading request" />;
  if (!review)
    return (
      <div className="space-y-4">
        <ErrorNote>{error ?? "This request is not in your queue."}</ErrorNote>
        <Link to="/alerts" className="text-sm font-semibold text-accent underline">
          Back to Alerts
        </Link>
      </div>
    );

  const patient = detail?.patient;
  const bed = review.patient?.bed ?? patient?.bed;
  const room = review.patient?.room ?? patient?.room;
  const closed = !["pending", "escalated"].includes(review.status);
  const score = detail?.risk.score;
  const priority = detail ? detailPriority(detail) : null;
  const band = priority?.band;
  const suggested = review.suggested_class;
  const unreviewedVocab = suggested?.source?.startsWith(UNREVIEWED_PREFIX);
  const prescriptionsValid = prescriptions.length > 0 && prescriptions.every(item => [item.medication, item.dose, item.route, item.frequency, item.duration].every(value => value.trim()));
  const riskHistory = (detail?.risk_history ?? []).filter(point => Date.parse(point.computed_at) >= openedAt - EIGHT_HOURS_MS);
  const timeline = [
    ...(patient?.admitted_at ? [{ time: patient.admitted_at, text: "Patient admitted", critical: false }] : []),
    ...(detail?.worry_signals ?? []).map(w => ({ time: w.created_at, text: `Nurse: ${WORRY_LABELS[w.level]}${w.note ? ` · ${w.note}` : ""}`, critical: w.level === 4 })),
    ...(detail?.nurse_notes ?? []).map(n => ({ time: n.recorded_at, text: `${n.author?.full_name ?? "Nurse"}: ${n.body}`, critical: false })),
    ...(detail?.escalations ?? []).flatMap(e => [
      { time: e.triggered_at, text: `Escalation: ${e.rule_label ?? e.rule}`, critical: true },
      ...(e.acknowledged_at ? [{ time: e.acknowledged_at, text: "Escalation acknowledged", critical: false }] : []),
      ...(e.assessed_at ? [{ time: e.assessed_at, text: "Bedside assessment recorded", critical: false }] : []),
    ]),
    { time: review.created_at, text: `Medication concern sent: ${CONDITIONS[review.condition]}`, critical: false },
    ...(review.acknowledged_at ? [{ time: review.acknowledged_at, text: "Medication request acknowledged", critical: false }] : []),
    ...(review.info_requested_at ? [{ time: review.info_requested_at, text: `More information requested: ${review.info_request_note ?? ""}`, critical: false }] : []),
    ...(review.reviewed_at ? [{ time: review.reviewed_at, text: `Medication request ${review.status}`, critical: false }] : []),
  ].filter(event => Number.isFinite(Date.parse(event.time))).sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).slice(-12);

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <Link to="/alerts" className="text-sm font-semibold text-accent">
        ‹ Alerts
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
            Approval review{room ? ` · Room ${room}` : ""}
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">
            {bed ? `Bed ${bed}` : (patient?.display_name ?? "Patient")}
          </h2>
        </div>
        <div className="max-w-xs">
          <p className="text-right text-xs text-ink-400">
            Read each section and tick it. Approve unlocks when all {SECTIONS.length} are ticked.
          </p>
          <div className="mt-2 flex justify-end gap-1" aria-hidden>
            {ticked.map((t, i) => (
              <span
                key={i}
                className={`h-1 w-7 rounded-full ${t ? "bg-accent" : "bg-ink-700"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {review.status === "escalated" && (
        <div className="mt-4 rounded-2xl border border-very/30 bg-very/10 px-4 py-3 text-sm">
          <span className="font-bold text-very">Escalated.</span>{" "}
          This request passed its response window and is now open to every
          prescriber on the unit.
        </div>
      )}
      {closed && (
        <div className="mt-4 rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm text-ink-400">
          This request is already closed ({review.status}). It is shown read-only.
        </div>
      )}

      <div className="mt-6 grid gap-x-7 md:grid-cols-2">
        <div>
          <Section index={0} title={SECTIONS[0]} checked={ticked[0]} onToggle={() => toggle(0)}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Patient" value={patient?.display_name} />
              <Field
                label="Age · sex"
                value={[patient?.age ?? patient?.age_band, patient?.sex].filter(Boolean).join(" · ") || null}
              />
              <Field label="Room" value={room ? `Room ${room}` : null} />
              <Field
                label="Admitted"
                value={patient ? new Date(patient.admitted_at).toLocaleString() : null}
              />
              <Field label="Diagnosis" value={patient?.diagnosis} />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">Allergies</p>
                {/* Three states, and the difference matters clinically. */}
                {patient?.allergies == null ? (
                  <p className="mt-0.5 text-sm font-semibold text-slight">Not recorded</p>
                ) : patient.allergies.length === 0 ? (
                  <p className="mt-0.5 text-sm font-semibold">None known</p>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold">{patient.allergies.join(", ")}</p>
                )}
              </div>
            </div>
          </Section>

          <Section index={1} title={SECTIONS[1]} checked={ticked[1]} onToggle={() => toggle(1)}>
            <div className="flex items-center gap-4">
              <div>
                <div className={`mb-1 flex h-12 items-end gap-0.5 ${band?.text ?? "text-ink-400"}`} aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index} className={`w-2 rounded-t-sm ${score != null && index < riskOutOfTen(score) ? "bg-current" : "bg-ink-700"}`} style={{ height: `${10 + index * 4}px` }} />)}</div>
                <p className="text-xs text-ink-400">Combined score</p>
                <p className="text-3xl font-extrabold tracking-tight text-ink-400">
                  {score == null ? "—" : riskOutOfTen(score)}
                  <span className="text-base text-ink-400">/10</span>
                </p>
                <p className={`text-xs font-bold ${band?.text ?? "text-ink-400"}`}>{priority?.label ?? "Not available"}</p>
                <p className={`mt-1 text-xs ${band?.text ?? "text-ink-400"}`}>{priority?.reason}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-ink-400">Nurse worry</p>
                <p className="text-sm font-bold">
                  {detail?.worry_signals[0] ? WORRY_LABELS[detail.worry_signals[0].level] : "Not recorded"}
                </p>
                {detail?.worry_signals[0] && (
                  <p className="mt-0.5 truncate text-xs text-ink-400">
                    {timeAgo(detail.worry_signals[0].created_at)}
                  </p>
                )}
              </div>
            </div>
            <RiskHistoryChart history={riskHistory} />
            <p className="mt-3 text-xs text-ink-400">Recorded combined risk scores from the last 8 hours.</p>
          </Section>

          <Section bare index={2} title={SECTIONS[2]} checked={ticked[2]} onToggle={() => toggle(2)}>
            <div className="grid grid-cols-2 gap-2">
              <VitalCard
                label="Heart rate"
                value={latest?.heart_rate}
                unit="bpm"
                band={bands.heart_rate}
                series={trend("heart_rate")}
              />
              <VitalCard
                label="Blood pressure"
                value={latest?.systolic_bp}
                unit={latest?.diastolic_bp ? `/${latest.diastolic_bp} mmHg` : "mmHg"}
                band={bands.systolic_bp}
                series={trend("systolic_bp")}
              />
              <VitalCard
                label="Resp. rate"
                value={latest?.resp_rate}
                unit="/min"
                band={bands.resp_rate}
                series={trend("resp_rate")}
              />
              <VitalCard
                label="SpO2"
                value={latest?.spo2}
                unit="%"
                band={bands.spo2}
                series={trend("spo2")}
              />
              <VitalCard
                label="Temp"
                value={latest?.temperature_c}
                unit="°C"
                band={bands.temperature_c}
                series={trend("temperature_c")}
              />
              <VitalCard
                label="Pain"
                value={latest?.pain_score}
                unit="/10"
                band={bands.pain_score}
                series={trend("pain_score")}
              />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
              {windowLabel} Badges are NEWS2 parameter scores, except pain,
              which uses the 0–10 rating scale. NEWS2 scores hypotension only,
              so it does not flag a high blood pressure — read the number, not
              the absence of a badge.
            </p>
          </Section>

          <Section bare index={3} title={SECTIONS[3]} checked={ticked[3]} onToggle={() => toggle(3)}>
            {detail?.nurse_notes.length ? (
              <ul className="space-y-3">
                {detail.nurse_notes.slice(0, 5).map((n) => (
                  <li key={n.id} className="rounded-3xl border border-ink-700 bg-ink-800 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-ink-400">{timeAgo(n.recorded_at)}</span>
                      <span className="text-[11px] font-semibold text-ink-400">
                        {n.author?.full_name ?? "Nurse"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slight">No nurse notes recorded for this patient.</p>
            )}
          </Section>
        </div>

        <div>
          <Section index={4} title={SECTIONS[4]} checked={ticked[4]} onToggle={() => toggle(4)}>
            <div className="space-y-3 divide-y divide-ink-700 [&>div:not(:first-child)]:pt-3">
              <Field label="Past history" value={patient?.past_history} />
              <Field label="Home medications" value={patient?.home_medications} />
              <Field label="Prior admissions" value={patient?.prior_admissions} />
              <Field label="Past responses" value={patient?.past_responses} />
            </div>
          </Section>

          <Section bare index={5} title={SECTIONS[5]} checked={ticked[5]} onToggle={() => toggle(5)}>
            <ol className="ml-1 space-y-4 border-l-2 border-ink-700 pl-5">
              {timeline.map((event, index) => <li key={`${event.time}-${index}`} className="relative">
                <span aria-hidden="true" className={`absolute -left-[27px] top-1 size-3 rounded ${event.critical ? "bg-very" : "bg-accent"}`} />
                <p className="text-[11px] text-ink-400">{new Date(event.time).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                <p className={`mt-1 text-sm ${event.critical ? "font-semibold" : ""}`}>{event.text}</p>
              </li>)}
            </ol>
            <div className="mt-4 border-t border-ink-700 pt-3">
              <p className="text-xs text-ink-400">Now</p>
              <p className="text-sm font-bold">
                {closed
                  ? `Request ${review.status}`
                  : `Waiting for your decision · sent ${timeAgo(review.created_at)}`}
              </p>
            </div>
          </Section>

          <Section accent index={6} title={SECTIONS[6]} checked={ticked[6]} onToggle={() => toggle(6)}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Suggested by the nurse · for you to decide
            </p>
            <p className="mt-2 text-sm">
              <span className="font-semibold">Condition:</span>{" "}
              {CONDITIONS[review.condition]}
            </p>
            {suggested ? (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Class suggested:</span> {suggested.label}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-400">
                No class suggested — free-text request only.
              </p>
            )}
            <p className="mt-3 rounded-xl bg-ink-900 p-3 text-sm">{review.request_note}</p>
            {unreviewedVocab && (
              <p className="mt-3 text-xs font-semibold text-slight">
                This class list has not been clinically reviewed for this unit.
              </p>
            )}
          </Section>

          <Section bare index={7} title={SECTIONS[7]} checked={ticked[7]} onToggle={() => toggle(7)}>
            <div className="space-y-4">
              {prescriptions.map((prescription, index) => <fieldset key={index} disabled={closed || busy} className="space-y-3 rounded-3xl border border-ink-700 bg-ink-800 p-4">
                <legend className="px-1 text-sm font-bold">Prescription {index + 1}</legend>
                {!closed && prescriptions.length > 1 && <button type="button" onClick={() => { setPrescriptions(items => items.filter((_, i) => i !== index)); clearPrescriptionTick(); }} className="float-right min-h-9 text-xs text-ink-400">Remove</button>}
                {suggested && <p className="text-xs text-ink-400">Nurse suggested: <span className="font-semibold text-accent">{suggested.label}</span></p>}
                <label className="block text-xs text-ink-400">Medication
                  <input value={prescription.medication} maxLength={200} onChange={event => editPrescription(index, "medication", event.target.value)} placeholder="Choose or type a medication" className="mt-1 min-h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-200" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([ ["dose", "Dose", "Enter dose"], ["route", "Route", "Enter route"], ["frequency", "How often", "Enter frequency"], ["duration", "For how long", "Enter duration"] ] as const).map(([key, label, placeholder]) => <label key={key} className="text-xs text-ink-400">{label}<input value={prescription[key]} maxLength={key === "route" ? 100 : 200} onChange={event => editPrescription(index, key, event.target.value)} placeholder={placeholder} className="mt-1 min-h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-200" /></label>)}
                </div>
                <label className="block text-xs text-ink-400">Instructions for nurse
                  <textarea rows={2} maxLength={2000} value={prescription.instructions} onChange={event => editPrescription(index, "instructions", event.target.value)} placeholder="Optional note" className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm text-ink-200" />
                </label>
              </fieldset>)}
              {!closed && <Button type="button" variant="ghost" className="w-full rounded-full" disabled={busy || prescriptions.length >= 20} onClick={() => { setPrescriptions(items => [...items, blankPrescription()]); clearPrescriptionTick(); }}>Add another prescription</Button>}
              <p className="text-xs text-ink-400">Enter your prescription details. This records your decision in Salus.</p>
            </div>
            {review.info_requested_at && (
              <p className="mt-3 rounded-xl border border-slight/30 bg-slight/10 p-3 text-xs">
                <span className="font-bold text-slight">Waiting on the nurse.</span>{" "}
                You asked {timeAgo(review.info_requested_at)}:{" "}
                <span className="italic">“{review.info_request_note}”</span>
                {" "}This request is still open and still on the clock.
              </p>
            )}
            <label className="mt-3 block text-xs font-semibold text-ink-400" htmlFor="decision-note">
              Note for the nurse
            </label>
            <textarea
              id="decision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={closed}
              placeholder="What you decided and why"
              className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-800 p-3 text-sm disabled:opacity-60"
            />
          </Section>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card className="mt-2 rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold tracking-tight">Approve prescription</p>
            <p className="mt-0.5 text-sm text-ink-400">
              {closed
                ? "This request is closed."
                : allTicked
                  ? prescriptionsValid ? "All sections reviewed." : "Complete the prescription details to approve."
                  : `Tick every section above to unlock — ${tickedCount} of ${SECTIONS.length} done.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72">
            <Button className="rounded-full" onClick={() => decide("approve")} disabled={!allTicked || !prescriptionsValid || !detail || busy || closed}>
              {allTicked ? "Approve prescription" : `Locked: review all ${SECTIONS.length} sections`}
            </Button>
            <Button className="rounded-full" onClick={requestInfo} disabled={busy || closed} variant="ghost">
              Request more info from nurse
            </Button>
            <Button className="rounded-full" onClick={() => decide("reject")} disabled={!allTicked || !detail || busy || closed} variant="ghost">
              Decline
            </Button>
          </div>
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-400">
        Decision support only. You make the final call on every medication.
      </p>
    </div>
  );

  function clearPrescriptionTick() {
    setTicked(previous => previous.map((value, index) => index === 7 ? false : value));
  }

  function editPrescription(index: number, key: keyof PrescriptionDraft, value: string) {
    setPrescriptions(items => items.map((item, i) => i === index ? { ...item, [key]: value } : item));
    clearPrescriptionTick();
  }

  function toggle(i: number) {
    setTicked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }
}

function blankPrescription(): PrescriptionDraft {
  return { medication: "", dose: "", route: "", frequency: "", duration: "", instructions: "" };
}

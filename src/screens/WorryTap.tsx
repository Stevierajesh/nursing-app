import ClinicalPriority from "../components/ClinicalPriority";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { riskOutOfTen } from "../lib/risk";
import PatientVitals, { ObservationHistory } from "../components/PatientVitals";
import {
  WORRY_REASONS,
  WORRY_LABELS,
  type WorryLevel,
  type PatientDetail,
  type WorryReason,
  type WorryResponse,
} from "../lib/types";
import {
  Button,
  Card,
  ErrorNote,
  NewsBadge,
  Spinner,
  timeAgo,
} from "../components/Primitives";

/**
 * The one tap.
 *
 * Design constraints, in priority order:
 *
 *  1. Level selection is a single tap and submits nothing by itself -- a nurse
 *     who taps the wrong level must be able to correct it without having
 *     already paged someone.
 *  2. Reasons are optional. The flow must complete in two seconds for a nurse
 *     who has nothing to add beyond "something is off".
 *  3. Capture time is measured and sent. "Will nurses actually use it?" is
 *     answerable with a median, and that only works if we instrument it.
 */

/*
 * The mockups keep the fill pale at every level and mark the chosen one with a
 * ring in that level's own colour, rather than darkening the swatch. Selection
 * then reads as "this one", not as "this one is worse" -- the height ramp
 * already carries severity, and a filled-in red block implied the signal had
 * been sent before Submit was pressed.
 */
const LEVELS: {
  level: WorryLevel;
  color: string;
  selectedRing: string;
  height: string;
}[] = [
  {
    level: 0,
    color: "border-calm/40 bg-calm/15",
    selectedRing: "ring-calm",
    height: "h-8",
  },
  {
    level: 1,
    color: "border-mild/40 bg-mild/15",
    selectedRing: "ring-mild",
    height: "h-11",
  },
  {
    level: 2,
    color: "border-slight/40 bg-slight/15",
    selectedRing: "ring-slight",
    height: "h-14",
  },
  {
    level: 3,
    color: "border-worried/40 bg-worried/15",
    selectedRing: "ring-worried",
    height: "h-18",
  },
  {
    level: 4,
    color: "border-very/40 bg-very/15",
    selectedRing: "ring-very",
    height: "h-22",
  },
];

export default function WorryTap({
  patientId: selectedPatientId,
  embedded = false,
  header,
}: {
  patientId?: string;
  embedded?: boolean;
  /** Embedded only: sits above the vitals in the left column. */
  header?: ReactNode;
} = {}) {
  const { patientId: routePatientId } = useParams<{ patientId: string }>();
  const patientId = selectedPatientId ?? routePatientId;
  const navigate = useNavigate();
  const { refresh } = usePatients();
  const { me } = useAuth();

  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<WorryLevel | null>(null);
  const [reasons, setReasons] = useState<WorryReason[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WorryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clock starts when the screen opens, so capture_ms measures the real
  // interaction cost rather than just the time spent typing a note.
  const openedAt = useRef<number>(0);

  useEffect(() => {
    openedAt.current = Date.now();
    if (!patientId) return;
    let active = true;
    const load = () => api
      .get<PatientDetail>(`/api/v1/patients/${patientId}`)
      .then((d) => { if (active) { setDetail(d); setError(null); } })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [patientId]);

  function toggleReason(id: WorryReason) {
    setReasons((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (level === null || !patientId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<WorryResponse>("/api/v1/worry", {
        patient_id: patientId,
        level,
        reasons: level === 0 ? [] : reasons,
        note: level === 0 ? null : note.trim() || null,
        capture_ms: Date.now() - openedAt.current,
      });
      setResult(res);
      void refresh();
      // Haptic confirmation: a nurse should know the tap landed without
      // looking at the screen.
      if ("vibrate" in navigator)
        navigator.vibrate(res.escalated ? [40, 60, 40] : 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your signal");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading patient" />;
  if (error && !detail) return <ErrorNote>{error}</ErrorNote>;
  if (!detail) return null;

  const { patient, risk, vitals } = detail;
  const lastVitals = vitals.at(-1);

  // ---- confirmation state ------------------------------------------------
  if (result) {
    return (
      // Capped: the outcome is a short verdict and a six-line breakdown, and
      // reading it across the full desktop measure is worse than reading it in
      // a column the width of the card it arrived in.
      <div className="flex max-w-3xl flex-col gap-5 p-4">
        <div
          className={`rounded-2xl border p-5 ${
            result.escalated
              ? "border-very/40 bg-very/10"
              : "border-calm/30 bg-calm/10"
          }`}
        >
          {/* Badge carries the outcome's colour, as on the escalation cards.
              Flat dark type here read as a heading rather than a result. */}
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              result.escalated ? "bg-very/15 text-very" : "bg-calm/15 text-calm"
            }`}
          >
            {result.escalated ? "Escalated" : "Recorded"}
          </span>
          <p className="mt-2 text-lg leading-snug">{result.message}</p>
        </div>

        <ClinicalPriority patient={{ risk_score: result.risk.score, latest_news: result.risk.latest_news, open_escalation: result.escalation ?? detail.escalations.find(escalation => ["open", "acknowledged", "auto_escalated"].includes(escalation.status)) ?? null }} />
        <Card>
          <div className="text-xs uppercase tracking-wide text-ink-400">
            Risk contributions (points out of 10)
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row
              label="Your worry"
              value={`+${(result.risk.worry_component / 10).toFixed(1)}`}
            />
            <Row
              label="Current vitals (NEWS)"
              value={`+${(result.risk.vitals_component / 10).toFixed(1)}`}
            />
            <Row
              label="Vitals trend"
              value={`+${(result.risk.trend_component / 10).toFixed(1)}`}
            />
            <div className="my-2 border-t border-ink-700" />
            <Row
              label="Combined score"
              value={`${riskOutOfTen(result.risk.score)}/10`}
              emphasis
            />
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Total rounded to a whole number, with a minimum display of 1/10.
          </p>
          {!result.escalated && (
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Worry on its own does not page anyone. Your signal is on the
              charge nurse's board, and if this patient's vitals start to drift
              it will escalate automatically with your reason attached.
            </p>
          )}
        </Card>

        <Button
          onClick={() => {
            if (embedded) {
              setResult(null);
              setLevel(null);
              setReasons([]);
              setNote("");
              openedAt.current = Date.now();
            } else navigate("/patients");
          }}
        >
          {embedded ? "Record another score" : "Back to patients"}
        </Button>
      </div>
    );
  }

  if (me?.user.role === "prescriber")
    return (
      <Card>
        Use the Meds tab to review medication requests for this patient.
      </Card>
    );

  // ---- capture state -----------------------------------------------------
  return (
    /*
     * Splits in two on a wide screen: context on the left, the tap on the
     * right. Side by side the whole capture clears a laptop viewport, which
     * stacked it does not -- standalone at 1512px the vitals alone filled the
     * fold and "How worried are you?" needed a scroll to reach, on the one
     * screen whose entire purpose is that question.
     *
     * Below lg both forms are a single column, and the two nested groups
     * render the same as the old flat list.
     */
    <div
      className={`grid gap-6 lg:grid-cols-2 lg:items-stretch ${embedded ? "" : "p-4"}`}
    >
      <div className="flex min-w-0 flex-col gap-5">
        {embedded && header}
        {!embedded && (
          <header>
          {/* Teal back link and an eyebrow over the title, matching Respond --
              the two patient-scoped screens should not open differently. */}
          <button
            onClick={() => navigate("/patients")}
            className="mb-3 text-sm text-accent"
          >
            ← My patients
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            {[patient.room ? `Room ${patient.room}` : null, me?.unit?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {patient.display_name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-400">
            <NewsBadge score={risk.latest_news} band={risk.news_band} />
            {risk.trend_slope_per_hour > 0.25 && (
              <span className="rounded-md border border-slight/30 bg-slight/10 px-2 py-0.5 text-xs font-semibold text-slight">
                ↑ trending up
              </span>
            )}
          </div>
          {lastVitals && (
            <p className="mt-2 text-xs text-ink-400">
              Last obs {timeAgo(lastVitals.recorded_at)} · RR{" "}
              {lastVitals.resp_rate} · SpO₂ {lastVitals.spo2}% · HR{" "}
              {lastVitals.heart_rate}
            </p>
          )}
          </header>
        )}

        <ClinicalPriority patient={{
          risk_score: risk.score,
          latest_news: risk.latest_news,
          news_alert: detail.news_alert,
          open_escalation: detail.escalations.find(escalation => ["open", "acknowledged", "auto_escalated"].includes(escalation.status)) ?? null,
        }} />
        <PatientVitals patient={patient} vitals={vitals} bands={detail.vital_bands} />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
            How worried are you?
          </h2>
        <div
          // Capped: the scale is read as five bars of increasing height, and
          // that comparison breaks down once each bar is a hand-span wide.
          className="grid max-w-xl grid-cols-5 gap-2 sm:gap-3"
          role="group"
          aria-label="How worried are you?"
        >
          {LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              onClick={() => setLevel(l.level)}
              aria-pressed={level === l.level}
                className="flex min-h-36 min-w-0 flex-col justify-end gap-3 rounded-xl px-0.5 py-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  aria-hidden
                  className={`block w-full rounded-xl border-2 transition ${l.height} ${l.color} ${level === l.level ? `${l.selectedRing} ring-2 ring-offset-2 ring-offset-ink-800` : ""}`}
                />
                <span
                  className={`min-h-10 text-xs leading-5 sm:text-sm ${level === l.level ? "font-bold text-ink-200" : "text-ink-400"}`}
                >
                  {WORRY_LABELS[l.level]}
                </span>
              </button>
            ))}
          </div>
        </section>
  
        {/* Reasons appear only once a worry level is chosen, and never for
            "not worried" -- asking why someone is not worried is noise. */}
        {level !== null && level > 0 && (
          <>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
                What's off?{" "}
                <span className="font-normal normal-case text-ink-400">
                  optional
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {WORRY_REASONS.map((r) => {
                  const on = reasons.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleReason(r.id)}
                      aria-pressed={on}
                      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-ink-600 bg-ink-800 text-ink-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </section>
  
            <section>
              <label
                htmlFor="note"
                className="mb-2 block text-sm font-semibold uppercase tracking-wide text-ink-400"
              >
                Anything else?{" "}
                <span className="font-normal normal-case text-ink-400">
                  optional
                </span>
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="In your words — this goes to the charge nurse."
                className="w-full max-w-2xl rounded-xl border border-ink-600 bg-ink-800 p-3 text-base placeholder:text-ink-400 focus:border-accent focus:outline-none"
              />
            </section>
          </>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div>
          <Button
            onClick={submit}
            disabled={level === null || submitting}
            className="w-full"
          >
            {submitting
              ? "Sending…"
              : level === null
                ? "Choose a level"
                : level === 0
                  ? "Record check-in"
                  : "Submit score"}
          </Button>
        </div>

        <ObservationHistory vitals={vitals} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={emphasis ? "font-semibold" : "text-ink-200"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasis ? "text-lg font-bold" : "text-ink-200"}`}
      >
        {value}
      </span>
    </div>
  );
}

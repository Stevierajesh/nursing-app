import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  WORRY_REASONS,
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

const LEVELS = [
  {
    level: 0 as const,
    label: "Not worried",
    hint: "Routine check-in",
    classes:
      "border-calm/30 bg-calm/10 text-calm data-[selected=true]:bg-calm data-[selected=true]:text-ink-900",
  },
  {
    level: 1 as const,
    label: "Slightly worried",
    hint: "Something small is off",
    classes:
      "border-slight/30 bg-slight/10 text-slight data-[selected=true]:bg-slight data-[selected=true]:text-ink-900",
  },
  {
    level: 2 as const,
    label: "Very worried",
    hint: "I want eyes on this patient",
    classes:
      "border-very/30 bg-very/10 text-very data-[selected=true]:bg-very data-[selected=true]:text-white",
  },
];

export default function WorryTap() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<0 | 1 | 2 | null>(null);
  const [reasons, setReasons] = useState<WorryReason[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WorryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clock starts when the screen opens, so capture_ms measures the real
  // interaction cost rather than just the time spent typing a note.
  const openedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    api
      .get<PatientDetail>(`/api/v1/patients/${patientId}`)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
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
        reasons,
        note: note.trim() || null,
        capture_ms: Date.now() - openedAt.current,
      });
      setResult(res);
      // Haptic confirmation: a nurse should know the tap landed without
      // looking at the screen.
      if ("vibrate" in navigator) navigator.vibrate(res.escalated ? [40, 60, 40] : 30);
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
      <div className="flex flex-col gap-5 p-4">
        <div
          className={`rounded-2xl border p-5 ${
            result.escalated
              ? "border-very/40 bg-very/10"
              : "border-calm/30 bg-calm/10"
          }`}
        >
          <div className="text-sm font-semibold uppercase tracking-wide text-ink-200">
            {result.escalated ? "Escalated" : "Recorded"}
          </div>
          <p className="mt-2 text-lg leading-snug">{result.message}</p>
        </div>

        <Card>
          <div className="text-xs uppercase tracking-wide text-ink-400">
            How this was scored
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Your worry" value={`+${result.risk.worry_component.toFixed(1)}`} />
            <Row
              label="Current vitals (NEWS)"
              value={`+${result.risk.vitals_component.toFixed(1)}`}
            />
            <Row
              label="Vitals trend"
              value={`+${result.risk.trend_component.toFixed(1)}`}
            />
            <div className="my-2 border-t border-ink-700" />
            <Row
              label="Fused risk"
              value={result.risk.score.toFixed(1)}
              emphasis
            />
          </div>
          {!result.escalated && (
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Worry on its own does not page anyone. Your signal is on the
              charge nurse's board, and if this patient's vitals start to drift
              it will escalate automatically with your reason attached.
            </p>
          )}
        </Card>

        <Button onClick={() => navigate("/")}>Back to my patients</Button>
      </div>
    );
  }

  // ---- capture state -----------------------------------------------------
  return (
    <div className="flex flex-col gap-5 p-4 pb-32">
      <header>
        <button
          onClick={() => navigate("/")}
          className="mb-3 text-sm text-ink-400"
        >
          ← My patients
        </button>
        <h1 className="text-2xl font-bold">{patient.display_name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-400">
          {patient.room && <span>Room {patient.room}</span>}
          <span aria-hidden>·</span>
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

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          How worried are you?
        </h2>
        <div className="flex flex-col gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              data-selected={level === l.level}
              onClick={() => setLevel(l.level)}
              aria-pressed={level === l.level}
              className={`min-h-20 rounded-2xl border-2 px-5 text-left transition ${l.classes}`}
            >
              <div className="text-lg font-bold">{l.label}</div>
              <div className="text-sm opacity-80">{l.hint}</div>
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
              <span className="font-normal normal-case text-ink-600">
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
                        ? "border-white bg-white text-ink-900"
                        : "border-ink-600 bg-ink-700 text-ink-200"
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
              <span className="font-normal normal-case text-ink-600">
                optional
              </span>
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="In your words — this goes to the charge nurse."
              className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-base placeholder:text-ink-600 focus:border-ink-400 focus:outline-none"
            />
          </section>
        </>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Fixed footer so submit is always under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-ink-700 bg-ink-900/95 p-4 backdrop-blur">
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
                : "Raise this"}
        </Button>
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

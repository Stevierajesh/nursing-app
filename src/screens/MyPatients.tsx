import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { REASON_LABELS, type Patient } from "../lib/types";
import {
  ErrorNote,
  NewsBadge,
  Spinner,
  WorryDot,
  timeAgo,
} from "../components/Primitives";
import { useAuth } from "../lib/auth";

export default function MyPatients() {
  const { me, signOut } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<{ patients: Patient[] }>("/api/v1/patients/mine")
        .then((d) => active && setPatients(d.patients))
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));

    load();
    // Light polling. The nurse app is not the realtime surface -- the
    // dashboard is -- but an escalation raised by a colleague should still
    // show up without a manual refresh.
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (loading) return <Spinner label="Loading your patients" />;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My patients</h1>
          <p className="text-sm text-ink-400">
            {me?.user.full_name}
            {me?.unit ? ` · ${me.unit.name}` : ""}
          </p>
        </div>
        <button onClick={signOut} className="pt-1 text-sm text-ink-400">
          Sign out
        </button>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {patients.length === 0 && !error && (
        <div className="rounded-2xl border border-ink-700 bg-ink-800 p-6 text-center text-ink-400">
          <p className="font-medium text-ink-200">No patients assigned</p>
          <p className="mt-1 text-sm">
            Ask the charge nurse to add you to this shift.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {patients.map((p) => (
          <li key={p.id}>
            <Link
              to={`/worry/${p.id}`}
              className="block rounded-2xl border border-ink-700 bg-ink-800 p-4 transition active:border-ink-400"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">
                    {p.display_name}
                  </div>
                  <div className="text-sm text-ink-400">
                    {p.room ? `Room ${p.room}` : "No room"}
                  </div>
                </div>
                <NewsBadge score={p.latest_news} band={p.news_band} />
              </div>

              {/* An open escalation is the single most important thing on this
                  card, so it outranks worry and risk visually. */}
              {p.open_escalation && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    p.open_escalation.status === "auto_escalated"
                      ? "border-very/40 bg-very/15 text-very"
                      : "border-slight/40 bg-slight/15 text-slight"
                  }`}
                >
                  {p.open_escalation.status === "auto_escalated"
                    ? "No response yet — auto-escalated"
                    : p.open_escalation.status === "acknowledged"
                      ? "Charge nurse acknowledged"
                      : "Escalated — awaiting response"}
                  {p.escalation_rule_label && (
                    <span className="ml-1 font-normal opacity-80">
                      · {p.escalation_rule_label}
                    </span>
                  )}
                </div>
              )}

              {p.latest_worry && p.latest_worry.level > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <WorryDot level={p.latest_worry.level} />
                  {p.latest_worry.reasons.length > 0 && (
                    <span className="text-xs text-ink-400">
                      {p.latest_worry.reasons
                        .map((r) => REASON_LABELS[r] ?? r)
                        .join(", ")}
                    </span>
                  )}
                  <span className="text-xs text-ink-600">
                    {timeAgo(p.latest_worry.created_at)}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className={`h-full rounded-full ${
                      p.risk_score >= 50
                        ? "bg-very"
                        : p.risk_score >= 25
                          ? "bg-slight"
                          : "bg-calm"
                    }`}
                    style={{ width: `${Math.min(p.risk_score, 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-ink-400">
                  {p.risk_score.toFixed(0)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="px-2 pb-6 text-center text-xs leading-relaxed text-ink-600">
        Tap any patient to raise a concern. Worry alone never sets off an
        alarm — it only escalates when the vitals agree with you.
      </p>
    </div>
  );
}

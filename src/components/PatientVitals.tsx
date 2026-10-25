import type { Patient, Vitals } from "../lib/types";
import { useEffect, useState } from "react";
import { Card, timeAgo } from "./Primitives";

const FIELDS = [
  ["heart_rate", "Heart rate", "bpm"],
  ["resp_rate", "Respiratory rate", "/min"],
  ["spo2", "Oxygen saturation", "%"],
  ["systolic_bp", "Systolic BP", "mmHg"],
  ["diastolic_bp", "Diastolic BP", "mmHg"],
  ["temperature_c", "Temperature", "°C"],
] as const;

export default function PatientVitals({ patient, vitals }: { patient: Patient; vitals: Vitals[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const latest = vitals.at(-1);
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Latest observations</h2>
      {latest && <span className="rounded-full border border-ink-600 px-2 py-1 text-xs text-ink-200">{latest.source === "simulation" ? "Simulated" : "Charted"}</span>}
    </div>
    {patient.health_context && <p className="mt-2 text-sm text-ink-200">{patient.health_context}</p>}
    {!latest ? <p className="mt-3 text-sm text-ink-400">No observations yet. A configured simulation begins producing values when started.</p> : <>
      <p className="mt-2 flex items-center gap-2 text-xs text-ink-400"><span className="size-2 shrink-0 rounded-full bg-calm" aria-hidden />Live · observed {timeAgo(latest.recorded_at)} · {new Date(latest.recorded_at).toLocaleTimeString()} · refreshes every 15 seconds</p>
      {now - new Date(latest.recorded_at).getTime() > 60000 && <p className="mt-2 text-xs text-slight">No observation in the last minute. Values below are the last recorded measurements.</p>}
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3" aria-live="polite">
        {FIELDS.map(([key, label, unit]) => <div key={key}>
          <dt className="text-xs text-ink-400">{label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{latest[key] ?? "—"} <span className="text-xs font-normal text-ink-400">{unit}</span></dd>
          {patient.baseline_vitals?.[key] != null && <p className="text-xs text-ink-400">Baseline {patient.baseline_vitals[key]} {unit}</p>}
        </div>)}
      </dl>
      <details className="mt-4 border-t border-ink-600 pt-3">
        <summary className="cursor-pointer text-sm text-accent">Recent observation history</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-xs tabular-nums">
            <thead><tr>{["Time", "HR", "RR", "SpO₂", "BP", "Temp", "Source"].map(label => <th key={label} className="py-2 pr-3 font-medium text-ink-400">{label}</th>)}</tr></thead>
            <tbody>{vitals.slice(-12).reverse().map(v => <tr key={v.id} className="border-t border-ink-700">
              <td className="py-2 pr-3">{new Date(v.recorded_at).toLocaleTimeString()}</td>
              <td>{v.heart_rate ?? "—"}</td><td>{v.resp_rate ?? "—"}</td><td>{v.spo2 ?? "—"}%</td>
              <td>{v.systolic_bp ?? "—"}/{v.diastolic_bp ?? "—"}</td><td>{v.temperature_c ?? "—"}°C</td>
              <td>{v.source === "simulation" ? "Simulated" : "Charted"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </>}
  </Card>;
}

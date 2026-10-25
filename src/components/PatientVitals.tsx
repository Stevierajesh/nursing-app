import type { Patient, VitalBands, Vitals } from "../lib/types";
import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";
import { Card, timeAgo } from "./Primitives";

const FIELDS = [
  ["heart_rate", "Heart rate", "bpm"],
  ["resp_rate", "Respiratory rate", "/min"],
  ["spo2", "Oxygen saturation", "%"],
  ["systolic_bp", "Systolic BP", "mmHg"],
  ["diastolic_bp", "Diastolic BP", "mmHg"],
  ["temperature_c", "Temperature", "°C"],
] as const;

export default function PatientVitals({ patient, vitals, bands = {} }: { patient: Patient; vitals: Vitals[]; bands?: VitalBands }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const latest = vitals.at(-1);
  return <Card className="flex flex-1 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Latest observations</h2>
      {latest && <span className="rounded-full border border-ink-600 px-2 py-1 text-xs text-ink-200">{latest.source === "simulation" ? "Simulated" : "Charted"}</span>}
    </div>
    {patient.health_context && <p className="mt-2 text-sm text-ink-200">{patient.health_context}</p>}
    {!latest ? <p className="mt-3 text-sm text-ink-400">No observations yet. A configured simulation begins producing values when started.</p> : <>
      <p className="mt-2 flex items-center gap-2 text-xs text-ink-400"><span className="size-2 shrink-0 rounded-full bg-calm" aria-hidden />Live · observed {timeAgo(latest.recorded_at)} · {new Date(latest.recorded_at).toLocaleTimeString()} · refreshes every 15 seconds</p>
      {now - new Date(latest.recorded_at).getTime() > 60000 && <p className="mt-2 text-xs text-slight">No observation in the last minute. Values below are the last recorded measurements.</p>}
      <dl className="mt-4 grid flex-1 grid-cols-2 content-center gap-3 sm:grid-cols-3" aria-live="polite">
        {FIELDS.map(([key, label, unit]) => {
          const band = bands[key];
          const abnormal = band && band.label !== "normal";
          const tone = !abnormal ? "text-accent" : band.label === "watch" ? "text-slight" : band.label === "elevated" ? "text-worried" : "text-very";
          const series = vitals.slice(-20).map(v => v[key]);
          const readings = series.filter((value): value is number => value != null && Number.isFinite(value));
          const baseline = patient.baseline_vitals?.[key];
          return <div key={key} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${abnormal ? band.label === "watch" ? "border-slight/30 bg-slight/5" : band.label === "elevated" ? "border-worried/30 bg-worried/5" : "border-very/30 bg-very/5" : "border-ink-700 bg-ink-900/70"}`}>
            <dt className="flex flex-wrap items-start justify-between gap-1 text-xs text-ink-400">
              <span>{label}</span>
              {abnormal && <span className={`font-bold ${tone}`}>{band.direction === "low" ? "Low" : band.label === "watch" ? "Watch" : band.label === "elevated" ? "Elevated" : "High"}</span>}
            </dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{latest[key] ?? "—"}<span className="ml-1 text-xs font-normal tracking-normal text-ink-400">{unit}</span></dd>
            <div className="mt-3 h-10">
              {readings.length >= 2 ? <Sparkline values={series} label={`${label}: last ${readings.length} readings, from ${readings[0]} to ${readings.at(-1)} ${unit}`} className={tone} /> : <p className="text-[11px] text-ink-400">Trend appears after 2 readings</p>}
            </div>
            <p className="text-[11px] text-ink-400">{baseline != null ? `Baseline ${baseline} ${unit}` : `${readings.length} recent reading${readings.length === 1 ? "" : "s"}`}</p>
          </div>;
        })}
      </dl>
      <p className="mt-3 text-[11px] text-ink-400">Recent observations · each trend uses its own vertical scale</p>

    </>}
  </Card>;
}

export function ObservationHistory({ vitals }: { vitals: Vitals[] }) {
  if (vitals.length === 0) return null;
  return (
    <Card className="flex min-w-0 flex-col lg:flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <h3 className="text-xs font-semibold text-ink-400">Recent observation history</h3>
        <div className="mt-2 h-44 overflow-y-auto overflow-x-auto rounded-xl border border-ink-700 lg:h-auto lg:min-h-32 lg:flex-1 lg:basis-0">
          <table className="w-full min-w-[440px] text-left text-xs tabular-nums">
            {/* Sticky needs an opaque background or rows show through it. */}
            <thead className="sticky top-0 z-10 bg-ink-800">
              <tr>{["Time", "HR", "RR", "SpO₂", "BP", "Temp", "Source"].map(label => <th key={label} className="bg-ink-800 px-3 py-2 font-medium text-ink-400">{label}</th>)}</tr>
            </thead>
            <tbody>{vitals.slice(-40).reverse().map(v => <tr key={v.id} className="border-t border-ink-700">
              <td className="px-3 py-2">{new Date(v.recorded_at).toLocaleTimeString()}</td>
              <td className="px-3">{v.heart_rate ?? "—"}</td><td className="px-3">{v.resp_rate ?? "—"}</td><td className="px-3">{v.spo2 ?? "—"}%</td>
              <td className="px-3">{v.systolic_bp ?? "—"}/{v.diastolic_bp ?? "—"}</td><td className="px-3">{v.temperature_c ?? "—"}°C</td>
              <td className="px-3">{v.source === "simulation" ? "Simulated" : "Charted"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </Card>
  );
}

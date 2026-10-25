import { riskOutOfTen } from "../lib/risk";

export default function RiskHistoryChart({ history }: {
  history: { score: number; computed_at: string }[];
}) {
  const series = history.filter(point => Number.isFinite(Number(point.score)) && Number.isFinite(Date.parse(point.computed_at)))
    .sort((a, b) => Date.parse(a.computed_at) - Date.parse(b.computed_at));
  if (series.length < 2) return <p className="mt-4 text-xs text-ink-400">A risk trend will appear after two recorded scores.</p>;
  const start = Date.parse(series[0].computed_at);
  const end = Date.parse(series[series.length - 1].computed_at);
  const x = (time: string) => 16 + (Date.parse(time) - start) / Math.max(1, end - start) * 288;
  const y = (score: number) => 130 - Math.max(0, Math.min(100, Number(score))) / 100 * 110;
  const path = series.map(p => `${x(p.computed_at)},${y(p.score)}`).join(" ");
  const last = series[series.length - 1];
  const timeLabel = (time: string) => new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return <div className="mt-4">
    <svg viewBox="0 0 320 150" className="w-full text-very" role="img" aria-label={`Combined risk trend from ${riskOutOfTen(series[0].score)} to ${riskOutOfTen(last.score)} out of 10, ${timeLabel(series[0].computed_at)} to ${timeLabel(last.computed_at)}`}>
      <line x1="16" x2="304" y1={y(80)} y2={y(80)} stroke="currentColor" strokeDasharray="4 4" strokeOpacity="0.5" />
      <text x="16" y={y(80) - 5} fill="currentColor" fontSize="9">High (8+)</text>
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.computed_at)} cy={y(last.score)} r="4" fill="currentColor" />
    </svg>
    <div className="flex justify-between text-[10px] text-ink-400"><span>{timeLabel(series[0].computed_at)}</span><span>{timeLabel(last.computed_at)}</span></div>
  </div>;
}

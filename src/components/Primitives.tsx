import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-400">
      <div
        className="size-5 animate-spin rounded-full border-2 border-ink-600 border-t-white"
        role="status"
        aria-label={label}
      />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-white text-ink-900 active:bg-ink-200 disabled:bg-ink-600",
    ghost:
      "bg-ink-700 text-white active:bg-ink-600 border border-ink-600 disabled:opacity-50",
    danger: "bg-very text-white active:brightness-90 disabled:opacity-50",
  }[variant];

  return (
    <button
      {...rest}
      className={`min-h-12 rounded-xl px-5 font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/** NEWS badge. Colour tracks the clinical response band, not the raw number. */
export function NewsBadge({
  score,
  band,
}: {
  score: number | null;
  band: string;
}) {
  if (score === null) {
    return <span className="text-xs text-ink-400">no vitals</span>;
  }

  const tone =
    {
      high: "bg-very/15 text-very border-very/30",
      medium: "bg-slight/15 text-slight border-slight/30",
      low: "bg-ink-600/50 text-ink-200 border-ink-600",
      none: "bg-calm/10 text-calm border-calm/25",
    }[band] ?? "bg-ink-600/50 text-ink-200 border-ink-600";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
    >
      NEWS {score}
    </span>
  );
}

/** Dot indicating the most recent worry level on a patient. */
export function WorryDot({ level }: { level: 0 | 1 | 2 }) {
  if (level === 0) return null;
  const color = level === 2 ? "bg-very" : "bg-slight";
  const label = level === 2 ? "Very worried" : "Slightly worried";
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      <span className="text-xs text-ink-200">{label}</span>
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink-700 bg-ink-800 p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-very/30 bg-very/10 p-3 text-sm text-very"
    >
      {children}
    </div>
  );
}

/** Relative time, e.g. "4m ago". Clinical staff think in elapsed time. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

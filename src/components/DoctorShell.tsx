import AppHeader from "./AppHeader";
import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

/*
 * The prescriber layout from the design doc (pages 22-26): a persistent left
 * sidebar instead of the nurse's bottom pill nav.
 *
 * Same five routes, same app. A doctor approving a medication is reading the
 * same patient the nurse flagged, so splitting this into a separate console
 * would mean maintaining two renderings of one board. What differs is posture:
 * a nurse is standing at a bedside with one hand free, a doctor is triaging a
 * queue, so the nav earns permanent space here and not there.
 */

const NAV = [
  { to: "/board", label: "Risk" },
  { to: "/patients", label: "Patients" },
  { to: "/", label: "Map" },
  { to: "/meds", label: "Meds" },
  { to: "/alerts", label: "Alerts" },
];

export default function DoctorShell({
  children,
  unitLabel,
  account,
}: {
  children: ReactNode;
  unitLabel: string;
  account: ReactNode;
}) {
  const pathname = useLocation().pathname;
  const mapMode = pathname === "/";
  return (
    <div className={mapMode ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-full flex-col"}>
      <AppHeader />
      <div className={mapMode ? "relative min-h-0 flex-1" : "flex-1 lg:flex"}>
        <aside
          className={mapMode ? "absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/70 p-3 backdrop-blur-md lg:left-auto lg:top-4 lg:bottom-auto lg:w-60 lg:flex-col" : "flex shrink-0 flex-col gap-6 border-b border-ink-700 bg-ink-800 px-5 py-5 lg:w-60 lg:border-b-0 lg:border-r lg:py-7"}
          aria-label="Doctor navigation"
        >
          <div className="flex items-center justify-end gap-2.5">
            {account}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
              Doctor
            </span>
            <span className="text-xs text-ink-400">{unitLabel}</span>
          </div>

          <nav className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-12 items-center rounded-full px-5 text-sm font-semibold transition ${
                    (isActive || (n.to === "/alerts" && pathname.startsWith("/review/")))
                      ? "bg-accent text-white"
                      : "text-ink-200 hover:bg-ink-700/60"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

        </aside>

        <main className={mapMode ? "absolute inset-0" : "min-w-0 flex-1 px-5 py-6 lg:px-10 lg:py-9"}>
          {children}
        </main>
      </div>
    </div>
  );
}

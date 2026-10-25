import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import AppHeader from "./AppHeader";
import salusLogo from "../assets/salus-logo.svg";

/*
 * One shell, two postures.
 *
 * On anything touch-first each role keeps exactly what it had: the nurse's
 * floating pill over the thumb, the doctor's strip from the design doc (pages
 * 22-26). Phone and tablet alike -- a nurse holding an iPad wants the nav
 * under their thumb for the same reason a nurse holding a phone does.
 *
 * On a pointer-driven screen from `desk` up, both roles get a persistent left
 * sidebar. A pill centred under a 1512px window is phone chrome stranded on a
 * workstation -- it floated over the last row of the patients table, the Meds
 * grid and the Alerts list, and left the whole left third of the screen empty
 * to do it. See the `desk` definition in index.css for why this is not `lg`.
 *
 * The two asides are written out separately rather than one element with a
 * breakpoint-switched position, border and background. Those overrides fight
 * each other on shorthand-vs-longhand precedence (`border-0` against
 * `border-r`), which is a silent, ordering-dependent bug for the sake of not
 * repeating five nav items.
 */

const NAV = [
  { to: "/board", label: "Risk" },
  { to: "/patients", label: "Patients" },
  { to: "/", label: "Map" },
  { to: "/meds", label: "Meds" },
  { to: "/alerts", label: "Alerts" },
];

/** Content measure. Uncapped, the patients table pushed "Nurse level" and
 *  "Reason" further apart than either column was wide. */
const MEASURE = "mx-auto w-full max-w-7xl";

export default function AppShell({
  variant,
  unitLabel,
  account,
  children,
}: {
  variant: "nurse" | "doctor";
  unitLabel: string;
  /**
   * Rendered per slot rather than passed as one node: the sidebar's account
   * sits at the bottom and must open upward, the doctor's phone strip sits at
   * the top and must open down. Only one slot is visible at a time.
   */
  account: (placement: "up" | "down") => ReactNode;
  children: ReactNode;
}) {
  const pathname = useLocation().pathname;
  const mapMode = pathname === "/" || pathname === "/map";
  const doctor = variant === "doctor";

  // A doctor reaches a review from their Alerts queue, so that tab stays lit
  // underneath it. A nurse gets there from the patients table instead, so the
  // rule is not theirs -- lighting Alerts would point at the wrong tab back.
  const active = (to: string, isActive: boolean) =>
    isActive || (doctor && to === "/alerts" && pathname.startsWith("/review/"));

  const navItems = (vertical: boolean) =>
    NAV.map((n) => (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.to === "/"}
        className={({ isActive }) =>
          `flex min-h-12 items-center rounded-full px-5 text-sm font-semibold transition ${
            active(n.to, isActive)
              ? "bg-accent text-white"
              : "text-ink-200 hover:bg-ink-700/60"
          } ${vertical ? "" : "shrink-0"}`
        }
      >
        {n.label}
      </NavLink>
    ));

  const roleChip = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
        {doctor ? "Doctor" : "Nurse"}
      </span>
      <span className="min-w-0 truncate text-xs text-ink-400">{unitLabel}</span>
    </div>
  );

  return (
    <div
      className={`flex flex-col desk:h-dvh desk:overflow-hidden ${
        mapMode ? "h-dvh overflow-hidden" : "min-h-dvh"
      }`}
    >
      {/* Full-width brand bar on touch; the sidebar carries the mark at desk. */}
      <div className="desk:hidden">
        <AppHeader />
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col desk:flex-row ${mapMode ? "relative" : ""}`}
      >
        {/* ---- doctor, below desk: the strip ---- */}
        {doctor && (
          <aside
            aria-label="Doctor navigation"
            className={
              mapMode
                ? "absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/70 p-3 backdrop-blur-md desk:hidden"
                : "flex shrink-0 flex-col gap-6 border-b border-ink-700 bg-ink-800 px-5 py-5 desk:hidden"
            }
          >
            <div className="flex items-center justify-end gap-2.5">
              {account("down")}
            </div>
            {roleChip}
            <nav className="flex flex-wrap gap-1.5">{navItems(false)}</nav>
          </aside>
        )}

        {/* ---- both roles, desk and up: the sidebar ---- */}
        <aside
          aria-label="Main navigation"
          className="hidden desk:flex desk:w-60 desk:shrink-0 desk:flex-col desk:gap-6 desk:overflow-y-auto desk:border-r desk:border-ink-700 desk:bg-ink-800 desk:px-5 desk:py-6"
        >
          <h1 className="flex items-center gap-3">
            <img src={salusLogo} alt="" className="size-9 shrink-0 object-contain" />
            <span className="-translate-y-[2px] font-brand text-3xl leading-none text-[#7b7878]">
              SALUS
            </span>
          </h1>

          {/* No role chip or unit label here. Both are fixed for the whole
              session, so on the one surface that is always on screen they are
              permanent furniture -- and both are already in the account menu
              one click below. The doctor's phone strip keeps its chip: that is
              its only unit indicator. */}
          <nav className="flex flex-col gap-2">{navItems(true)}</nav>

          <div className="mt-auto flex items-center pt-6">{account("up")}</div>
        </aside>

        <main
          className={
            mapMode
              ? "relative min-h-0 flex-1"
              : `min-w-0 flex-1 desk:overflow-y-auto ${
                  doctor ? "" : "pb-[calc(6rem+env(safe-area-inset-bottom))] desk:pb-0"
                }`
          }
        >
          {/* The brand bar is gone at desk, so the measure supplies the top
              margin the header used to give the first element on the page. */}
          {mapMode ? children : <div className={`${MEASURE} desk:px-4 desk:py-4`}>{children}</div>}
        </main>
      </div>

      {/* ---- nurse, below desk: the pill ---- */}
      {!doctor && (
        <nav
          aria-label="Main navigation"
          className={`fixed inset-x-0 bottom-0 z-20 w-full px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] desk:hidden ${
            mapMode ? "pointer-events-none" : "bg-ink-900/95 backdrop-blur"
          }`}
        >
          {/* The pill stays near phone width even on a wide shell: five targets
              stretched across a tablet are a long reach and look like a toolbar.
              The account circle sits outside it -- it is not a destination, and
              giving it a sixth slot would imply it is one. */}
          <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-2 sm:max-w-lg">
            <div
              className={`grid min-w-0 flex-1 grid-cols-5 rounded-full border border-ink-700 p-1.5 shadow-lg shadow-ink-200/5 ${
                mapMode ? "bg-white/65 backdrop-blur-md" : "bg-ink-800"
              }`}
            >
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center justify-center rounded-full text-xs font-semibold transition ${
                      isActive ? "bg-accent text-white" : "text-ink-400 hover:text-ink-200"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
            {account("up")}
          </div>
        </nav>
      )}
    </div>
  );
}

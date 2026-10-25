import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Identity and sign-out, folded into a single avatar button.
 *
 * This used to be a page header: unit over name on the left, a "Sign out" text
 * link on the right, a rule underneath, then the screen title. That is the
 * anatomy of a letterhead, and it spent the most valuable strip of a phone
 * screen on two things a nurse never needs mid-shift. Account details belong
 * behind the account control; the strip belongs to the patient.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function AccountMenu({
  fullName,
  unitLabel,
  roleLabel,
  onSignOut,
  placement = "up",
  children,
}: {
  fullName: string;
  unitLabel: string;
  roleLabel: string;
  onSignOut: () => void;
  /** "up" for the nurse's bottom nav, "down" for the doctor sidebar. */
  placement?: "up" | "down";
  /** Extra actions, e.g. switching views. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // pointerdown rather than click: a tap that starts outside should dismiss
    // without also activating whatever it landed on.
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${fullName}`}
        className={`flex size-12 items-center justify-center rounded-full border text-sm font-bold transition ${
          open
            ? "border-accent bg-accent text-white"
            : "border-ink-600 bg-ink-800 text-ink-200 hover:border-accent hover:text-accent"
        }`}
      >
        <span aria-hidden>{initials(fullName)}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 w-60 rounded-2xl border border-ink-700 bg-ink-800 p-3 shadow-xl shadow-ink-200/10 ${
            placement === "up" ? "bottom-14" : "top-14"
          }`}
        >
          <p className="truncate text-sm font-bold">{fullName}</p>
          <p className="mt-0.5 truncate text-xs text-ink-400">{roleLabel}</p>
          <p className="mt-0.5 truncate text-xs text-ink-400">{unitLabel}</p>

          <div className="mt-3 flex flex-col gap-1.5 border-t border-ink-700 pt-3">
            {children}
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              role="menuitem"
              className="min-h-11 rounded-xl px-3 text-left text-sm font-semibold text-ink-200 transition hover:bg-ink-700/60"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

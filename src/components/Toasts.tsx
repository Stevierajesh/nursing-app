import { useNavigate } from "react-router-dom";
import { useNotifications, type Notice } from "../lib/notifications";

/** Older ones stay in the queue but off screen; three is already a lot to read. */
const VISIBLE = 3;

const TONE = {
  critical: {
    edge: "bg-very",
    chip: "bg-very/15 text-very",
    bar: "bg-very",
    title: "text-very",
  },
  warning: {
    edge: "bg-slight",
    chip: "bg-slight/15 text-slight",
    bar: "bg-slight",
    title: "text-ink-200",
  },
} satisfies Record<Notice["severity"], Record<string, string>>;

export default function Toasts() {
  const { notices, dismiss } = useNotifications();
  const navigate = useNavigate();
  const shown = notices.slice(-VISIBLE);
  if (shown.length === 0) return null;

  return (
    // Keep the stack at the top; pointer events pass through between notices.
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] max-h-[calc(100dvh-2rem-env(safe-area-inset-top))] overflow-y-auto z-30 mx-auto flex w-full max-w-md flex-col gap-2.5 px-4"
      aria-live="polite"
    >
      {shown.map((n) => {
        const critical = n.severity === "critical";
        const tone = TONE[n.severity];
        return (
          <div
            key={n.id}
            role={critical ? "alert" : "status"}
            className="toast-in pointer-events-auto relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-800 shadow-xl shadow-ink-200/10"
          >
            {/* Severity reads from the edge, so the card itself stays white and
                the text keeps full contrast. */}
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 w-1 ${tone.edge}`}
            />

            <div className="flex items-start gap-3 py-3 pr-2 pl-4">
              <span
                aria-hidden
                className={`mt-0.5 flex size-8 shrink-0 items-end justify-center gap-0.5 rounded-full ${tone.chip}`}
              >
                {/* The risk glyph, miniaturised -- same mark as the patient rows. */}
                <span className={`mb-2.5 h-1.5 w-0.5 rounded-sm ${tone.bar}`} />
                <span className={`mb-2.5 h-2.5 w-0.5 rounded-sm ${tone.bar}`} />
                <span className={`mb-2.5 h-3.5 w-0.5 rounded-sm ${tone.bar}`} />
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${tone.title}`}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-400">
                  {n.body}
                </p>
                {n.patientId && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/respond/${n.patientId}`);
                      dismiss(n.id);
                    }}
                    className="mt-2 min-h-8 text-xs font-semibold text-accent"
                  >
                    Open patient →
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismiss(n.id)}
                aria-label={`Dismiss: ${n.title}`}
                className="-mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-ink-400 transition hover:bg-ink-900 hover:text-ink-200"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

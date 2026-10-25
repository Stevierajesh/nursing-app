import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface Notice {
  id: string;
  patientId?: string;
  severity: "critical" | "warning";
  title: string;
  body: string;
}

interface NotificationState {
  notices: Notice[];
  notify: (notice: Notice) => void;
  dismiss: (id: string) => void;
}

const NotificationsContext = createContext<NotificationState | null>(null);

/** A warning clears itself; a critical one stays until it is dismissed. */
const WARNING_TTL_MS = 9000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  // Every id ever raised. The poll should only produce an event on transition,
  // but StrictMode double-invokes effects and a dismissed notice must not
  // reappear on the next tick, so dedupe here rather than trusting the caller.
  const seen = useRef(new Set<string>());
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (notice: Notice) => {
      if (seen.current.has(notice.id)) return;
      seen.current.add(notice.id);
      setNotices((prev) => [...prev, notice]);

      if (notice.severity === "critical") {
        // Same haptic pattern the tap screen uses for an escalation, so the
        // phone says "this one matters" without being looked at.
        if ("vibrate" in navigator) navigator.vibrate([40, 60, 40]);
      } else {
        const timer = window.setTimeout(
          () => dismiss(notice.id),
          WARNING_TTL_MS,
        );
        timers.current.set(notice.id, timer);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <NotificationsContext.Provider value={{ notices, notify, dismiss }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const state = useContext(NotificationsContext);
  if (!state) throw new Error("NotificationsProvider is required");
  return state;
}

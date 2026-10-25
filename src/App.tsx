import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./lib/auth";
import { supabaseConfigured } from "./lib/supabase";
import { ErrorNote, Spinner } from "./components/Primitives";
import ConfigError from "./components/ConfigError";
import Login from "./screens/Login";
import MyPatients from "./screens/MyPatients";
import WorryTap from "./screens/WorryTap";
import Board from "./screens/Board";
import Alerts from "./screens/Alerts";
import UnitMap from "./screens/UnitMap";
import Medication from "./screens/Medication";
import Response from "./screens/Response";
import { PatientsProvider } from "./lib/patients";
import { NotificationsProvider } from "./lib/notifications";
import { useEscalationAlerts } from "./lib/useEscalationAlerts";
import Toasts from "./components/Toasts";

const NAV = [
  { to: "/board", label: "Risk" },
  { to: "/patients", label: "Patients" },
  { to: "/", label: "Map" },
  { to: "/meds", label: "Meds" },
  { to: "/alerts", label: "Alerts" },
];

/*
 * One shell width, shared by the content column and the fixed nav so the two
 * always line up. Phones stay at the original max-w-md; the steps below that
 * cover the iPad sizes -- mini portrait (744) lands on sm, the 10.2"/11"
 * portraits (810-834) on md, and every landscape plus the 12.9" portrait
 * (1024+) on lg. Changing one of these without the other misaligns the nav.
 */
const SHELL = "mx-auto w-full max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-5xl";

export default function App() {
  const { session, me, loading, error, signOut } = useAuth();
  const location = useLocation();

  if (!supabaseConfigured) return <ConfigError />;
  if (loading) return <Spinner label="Starting up" />;
  if (!session) return <Login />;

  // Signed into Supabase but the API has no profile for this account. Without
  // this branch the user would sit on a spinner with no way forward.
  if (!me) {
    return (
      <div className="flex min-h-full flex-col justify-center gap-4 p-6">
        <ErrorNote>{error ?? "Could not load your profile."}</ErrorNote>
        <button onClick={signOut} className="text-sm text-ink-400 underline">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <NotificationsProvider>
      <PatientsProvider>
        <EscalationAlerts />
        <div
          className={`${SHELL} min-h-full pb-[calc(6rem+env(safe-area-inset-bottom))]`}
        >
          <header className="flex items-center justify-between gap-3 px-4 pt-5 pb-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                {me.unit?.name ?? "My unit"}
              </p>
              <p className="mt-1 truncate text-xs text-ink-400">
                {me.user.full_name}
              </p>
            </div>
            <button
              onClick={signOut}
              className="min-h-11 shrink-0 px-2 text-xs text-ink-400"
            >
              Sign out
            </button>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<UnitMap />} />
              <Route path="/board" element={<Board />} />
              <Route path="/respond/:patientId" element={<Response />} />
              <Route path="/patients" element={<MyPatients />} />
              <Route
                path="/worry/:patientId"
                element={<WorryTap key={location.pathname} />}
              />
              <Route path="/map" element={<Navigate to="/" replace />} />
              <Route path="/meds" element={<Medication />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <nav
            aria-label="Main navigation"
            className={`${SHELL} fixed inset-x-0 bottom-0 z-20 bg-ink-900/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur`}
          >
            {/* The pill stays near phone width even on a wide shell: five targets
                stretched across 1024px are a long reach and look like a toolbar. */}
            <div className="mx-auto grid w-full max-w-md grid-cols-5 rounded-full border border-ink-700 bg-ink-800 p-1.5 shadow-lg shadow-ink-200/5 sm:max-w-lg">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center justify-center rounded-full text-xs font-semibold transition ${isActive ? "bg-accent text-white" : "text-ink-400 hover:text-ink-200"}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <Toasts />
        </div>
      </PatientsProvider>
    </NotificationsProvider>
  );
}

/** Subscribes the poll to the notification queue. Renders nothing. */
function EscalationAlerts() {
  useEscalationAlerts();
  return null;
}

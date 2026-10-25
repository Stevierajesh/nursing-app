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
import AppHeader from "./components/AppHeader";
import AccountMenu from "./components/AccountMenu";
import DoctorShell from "./components/DoctorShell";
import ApprovalReview from "./screens/ApprovalReview";
import DoctorRisk from "./screens/DoctorRisk";
import DoctorAlerts from "./screens/DoctorAlerts";

const NAV = [
  { to: "/board", label: "Risk" },
  { to: "/patients", label: "Patients" },
  { to: "/", label: "Map" },
  { to: "/meds", label: "Meds" },
  { to: "/alerts", label: "Alerts" },
];

// The app uses the device width; individual forms can limit their own measure.
const SHELL = "w-full";

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

  // Risk and Alerts answer a different question for a prescriber -- "what is
  // waiting on me" rather than "which of my patients is worst" -- so those two
  // routes get their own screens. The rest of the unit looks the same to both.
  const mapMode = location.pathname === "/" || location.pathname === "/map";
  const doctorMode = me.user.role === "prescriber";

  const routes = (
    <Routes>
      <Route path="/" element={<UnitMap />} />
      <Route path="/board" element={doctorMode ? <DoctorRisk /> : <Board />} />
      <Route path="/respond/:patientId" element={<Response />} />
      <Route path="/patients" element={<MyPatients doctorView={doctorMode} />} />
      <Route
        path="/worry/:patientId"
        element={<WorryTap key={location.pathname} />}
      />
      <Route path="/map" element={<Navigate to="/" replace />} />
      <Route path="/meds" element={<Medication />} />
      <Route path="/alerts" element={doctorMode ? <DoctorAlerts /> : <Alerts />} />
      <Route path="/review/:reviewId" element={<ApprovalReview key={location.pathname} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  if (doctorMode) {
    return (
      <NotificationsProvider>
        <PatientsProvider>
          <EscalationAlerts />
          <DoctorShell
            unitLabel={me.unit?.name ?? "My unit"}
            account={
              <AccountMenu
                fullName={me.user.full_name}
                unitLabel={me.unit?.name ?? "My unit"}
                roleLabel="Doctor"
                onSignOut={signOut}
                placement="down"
              />
            }
          >
            {routes}
          </DoctorShell>
          <Toasts />
        </PatientsProvider>
      </NotificationsProvider>
    );
  }

  return (
    <NotificationsProvider>
      <PatientsProvider>
        <EscalationAlerts />
        <div
          className={mapMode ? "flex h-dvh w-full flex-col overflow-hidden" : `${SHELL} min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))]`}
        >
          <AppHeader />
          <main className={mapMode ? "relative min-h-0 flex-1" : "w-full"}>{routes}</main>
          <nav
            aria-label="Main navigation"
            className={`${mapMode ? "w-full" : SHELL} fixed inset-x-0 bottom-0 z-20 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${mapMode ? "pointer-events-none" : "bg-ink-900/95 backdrop-blur"}`}
          >
            {/* The pill stays near phone width even on a wide shell: five targets
                stretched across 1024px are a long reach and look like a toolbar.
                The account circle sits outside it -- it is not a destination,
                and giving it a sixth slot would imply it is one. */}
            <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-2 sm:max-w-lg">
              <div className={`grid min-w-0 flex-1 grid-cols-5 rounded-full border border-ink-700 p-1.5 shadow-lg shadow-ink-200/5 ${mapMode ? "bg-white/65 backdrop-blur-md" : "bg-ink-800"}`}>
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
              <AccountMenu
                fullName={me.user.full_name}
                unitLabel={me.unit?.name ?? "My unit"}
                roleLabel="Nurse"
                onSignOut={signOut}
              />
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

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import AccountMenu from "./components/AccountMenu";
import AppShell from "./components/AppShell";
import ApprovalReview from "./screens/ApprovalReview";
import DoctorRisk from "./screens/DoctorRisk";
import DoctorAlerts from "./screens/DoctorAlerts";

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

  const unitLabel = me.unit?.name ?? "My unit";

  return (
    <NotificationsProvider>
      <PatientsProvider>
        <EscalationAlerts />
        <AppShell
          variant={doctorMode ? "doctor" : "nurse"}
          unitLabel={unitLabel}
          account={(placement) => (
            <AccountMenu
              fullName={me.user.full_name}
              unitLabel={unitLabel}
              roleLabel={doctorMode ? "Doctor" : "Nurse"}
              onSignOut={signOut}
              placement={placement}
            />
          )}
        >
          {routes}
        </AppShell>
        <Toasts />
      </PatientsProvider>
    </NotificationsProvider>
  );
}

/** Subscribes the poll to the notification queue. Renders nothing. */
function EscalationAlerts() {
  useEscalationAlerts();
  return null;
}

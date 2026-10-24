import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { supabaseConfigured } from "./lib/supabase";
import { ErrorNote, Spinner } from "./components/Primitives";
import ConfigError from "./components/ConfigError";
import Login from "./screens/Login";
import MyPatients from "./screens/MyPatients";
import WorryTap from "./screens/WorryTap";

export default function App() {
  const { session, me, loading, error, signOut } = useAuth();

  if (!supabaseConfigured) return <ConfigError />;
  if (loading) return <Spinner label="Starting up" />;
  if (!session) return <Login />;

  // Signed into Supabase but the API has no profile for this account. Without
  // this branch the user would sit on a spinner with no way forward.
  if (!me) {
    return (
      <div className="flex min-h-full flex-col justify-center gap-4 p-6">
        <ErrorNote>
          {error ?? "Could not load your profile."}
        </ErrorNote>
        <button onClick={signOut} className="text-sm text-ink-400 underline">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-md">
      <Routes>
        <Route path="/" element={<MyPatients />} />
        <Route path="/worry/:patientId" element={<WorryTap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Patient } from "./types";

interface PatientState {
  patients: Patient[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const PatientsContext = createContext<PatientState | null>(null);

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ patients: Patient[] }>("/api/v1/patients/mine");
      setPatients(data.patients);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load patients");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(timer);
  }, [refresh]);
  return <PatientsContext.Provider value={{ patients, loading, error, refresh }}>{children}</PatientsContext.Provider>;
}

export function usePatients() {
  const state = useContext(PatientsContext);
  if (!state) throw new Error("PatientsProvider is required");
  return state;
}

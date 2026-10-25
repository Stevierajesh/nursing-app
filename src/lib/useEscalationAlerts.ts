import { useEffect, useRef } from "react";
import { usePatients } from "./patients";
import { useNotifications } from "./notifications";
import {
  escalationEvents,
  snapshot,
  type PatientSnapshot,
} from "./escalationEvents";

/**
 * Raises in-app notices from the patient poll.
 *
 * Kept as a hook rather than folded into PatientsProvider so the fetching layer
 * stays unaware of the notification layer -- and so a future Realtime feed can
 * be added beside this without rewriting either.
 */
export function useEscalationAlerts() {
  const { patients, loading } = usePatients();
  const { notify } = useNotifications();
  const previous = useRef<Map<string, PatientSnapshot> | null>(null);

  useEffect(() => {
    if (loading) return;

    // The first completed load is the baseline. Without this every open
    // escalation on the unit would announce itself the moment a nurse signs in.
    if (previous.current === null) {
      previous.current = snapshot(patients);
      return;
    }

    for (const event of escalationEvents(previous.current, patients)) {
      notify(event);
    }
    previous.current = snapshot(patients);
  }, [patients, loading, notify]);
}

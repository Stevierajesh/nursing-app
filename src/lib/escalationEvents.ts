import type { Patient } from "./types";
import { patientPriority, riskOutOfTen } from "./risk";

/**
 * Turns two successive `/patients/mine` snapshots into the things worth
 * interrupting a nurse for.
 *
 * Pure on purpose: the trigger is currently the 15s poll, but swapping in a
 * Supabase Realtime subscription later should only change who calls this, not
 * what counts as an event.
 */

export interface PatientSnapshot {
  escalationId: string | null;
  escalationStatus: string | null;
  bandIndex: number;
}

export interface EscalationEvent {
  /** Stable per transition, so a repeated poll cannot raise it twice. */
  id: string;
  patientId: string;
  severity: "critical" | "warning";
  title: string;
  body: string;
}


export function snapshot(patients: Patient[]): Map<string, PatientSnapshot> {
  return new Map(
    patients.map((p) => [
      p.id,
      {
        escalationId: p.open_escalation?.id ?? null,
        escalationStatus: p.open_escalation?.status ?? null,
        bandIndex: patientPriority(p).rank,
      },
    ]),
  );
}

function where(p: Patient): string {
  return (
    [p.bed ? `Bed ${p.bed}` : null, p.room ? `Room ${p.room}` : null]
      .filter(Boolean)
      .join(" · ") || p.display_name
  );
}

export function escalationEvents(
  previous: Map<string, PatientSnapshot>,
  patients: Patient[],
): EscalationEvent[] {
  const events: EscalationEvent[] = [];

  for (const p of patients) {
    const before = previous.get(p.id);
    // A patient newly on the list has no "before" to compare against. Treating
    // that as a change would fire on every shift handover.
    if (!before) continue;

    const now = {
      escalationId: p.open_escalation?.id ?? null,
      escalationStatus: p.open_escalation?.status ?? null,
      bandIndex: patientPriority(p).rank,
    };

    if (
      now.escalationStatus === "auto_escalated" &&
      before.escalationStatus !== "auto_escalated"
    ) {
      events.push({
        id: `overdue:${now.escalationId}`,
        patientId: p.id,
        severity: "critical",
        title: `${where(p)} — escalation overdue`,
        body: `${p.display_name} has not been acknowledged. Open to respond.`,
      });
    } else if (now.escalationId && now.escalationId !== before.escalationId) {
      events.push({
        id: `opened:${now.escalationId}`,
        patientId: p.id,
        severity: "warning",
        title: `${where(p)} — escalation opened`,
        body: `${p.display_name} · Combined score ${riskOutOfTen(p.risk_score)}/10. Acknowledge when you have seen it.`,
      });
    }

    // Only upward band moves. A score settling back down is good news and does
    // not need to take over the screen.
    if (now.bandIndex > before.bandIndex) {
      const priority = patientPriority(p);
      events.push({
        id: `priority:${p.id}:${priority.rank}:${priority.label}`,
        patientId: p.id,
        severity: priority.rank === 3 ? "critical" : "warning",
        title: `${where(p)} — ${priority.label}`,
        body: `${p.display_name} · ${priority.reason} · Combined score ${riskOutOfTen(p.risk_score)}/10.`,
      });
    }
  }

  return events;
}

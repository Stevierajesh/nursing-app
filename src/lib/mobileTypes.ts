import type { Vitals } from "./types";
export interface UnitBed {
  id: string;
  org_id: string;
  unit_id: string;
  room: string;
  bed: string;
  occupied: boolean;
}
export interface Unit {
  id: string;
  name: string;
}
export interface Prescriber {
  id: string;
  full_name: string;
}
export type ReviewCondition = "blood_pressure" | "blood_sugar" | "heart_rate";
export const CONDITIONS: Record<ReviewCondition, string> = {
  blood_pressure: "Blood pressure",
  blood_sugar: "Blood sugar",
  heart_rate: "Heart rate",
};
/**
 * The vocabulary a nurse picks a suggestion from. `source` is the attribution:
 * a row still carrying the placeholder marker has not been clinically reviewed
 * and the UI says so.
 */
export interface MedicationClass {
  id: string;
  condition: ReviewCondition;
  label: string;
  source: string | null;
}

export const UNREVIEWED_PREFIX = "UNREVIEWED";

export interface PrescriptionDraft {
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface MedicationReview {
  prescriptions?: PrescriptionDraft[];
  reviewed_sections?: number[];
  id: string;
  patient_id: string;
  prescriber_id: string;
  condition: ReviewCondition;
  suggested_class_id: string | null;
  suggested_class?: { label: string; source: string | null } | null;
  /**
   * pending and escalated are open; the rest are closed. "reviewed" is the
   * legacy two-state outcome and is never written by current code.
   */
  status: "pending" | "escalated" | "approved" | "rejected" | "dismissed" | "reviewed";
  request_note: string;
  review_note: string | null;
  decision_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  /** The clock behind the second level of escalation. */
  sla_deadline: string | null;
  acknowledged_at: string | null;
  escalated_at: string | null;
  escalated_to: string | null;
  /** A prescriber question back to the nurse. Leaves the request open. */
  info_requested_at: string | null;
  info_request_note: string | null;
  vitals_snapshot: Partial<Vitals>;
  patient?: { display_name: string; room: string | null; bed: string | null };
}

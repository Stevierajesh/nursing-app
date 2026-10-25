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

export interface MedicationReview {
  id: string;
  patient_id: string;
  prescriber_id: string;
  condition: ReviewCondition;
  suggested_class_id: string | null;
  suggested_class?: { label: string; source: string | null } | null;
  status: "pending" | "reviewed" | "dismissed";
  request_note: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  vitals_snapshot: Partial<Vitals>;
  patient?: { display_name: string; room: string | null; bed: string | null };
}

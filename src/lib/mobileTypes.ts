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

/**
 * What Salus recommends for one patient and condition, computed from their
 * latest observation by `services/recommendation.py`.
 *
 * Two provenances ride along and both matter. `rationale` is the citable half
 * — which published cut point the reading fell in. `rules_source` is the
 * uncitable half — the band-to-class mapping, which is a placeholder. Any
 * surface showing `class_label` must show that it is unreviewed.
 *
 * `class_label` is null when there is a finding but no class for it: a low
 * reading, where the answer is usually to withhold an agent rather than start
 * one, and this vocabulary cannot express that.
 */
export interface Recommendation {
  patient_id: string;
  condition: ReviewCondition;
  band: "low" | "watch" | "high" | "critical";
  reading: string;
  rationale: string;
  class_label: string | null;
  class_id: string | null;
  class_source: string | null;
  rules_version: string;
  rules_source: string;
}

/** What the nurse did with the recommendation. Derived server-side. */
export type NurseAction = "accepted" | "countered" | "declined" | "unprompted" | "none";

export const NURSE_ACTION_LABELS: Record<NurseAction, string> = {
  accepted: "Accepted the Salus suggestion",
  countered: "Countered with a different class",
  declined: "Declined the suggestion, sent no class",
  unprompted: "Suggested a class with no Salus suggestion",
  none: "Free-text request, no class",
};

/**
 * A deterioration escalation as the prescriber queue receives it, with the
 * nurse's own words joined on.
 *
 * The backend only sends a prescriber the rows that reached them -- a pairing
 * rule, where nurse concern and NEWS2 agreed, or anything the nursing tier let
 * breach its SLA. Objective-only escalations stay with the nursing tier, so
 * this queue is never the whole board.
 */
export interface QueuedEscalation {
  id: string;
  patient_id: string;
  rule: string;
  rule_label?: string;
  status: "open" | "acknowledged" | "assessed" | "resolved" | "auto_escalated";
  triggered_at: string;
  sla_deadline: string | null;
  acknowledged_at: string | null;
  assessed_at: string | null;
  patient?: { id: string; display_name: string; room: string | null; unit_id: string | null };
  worry_signal?: {
    id: string;
    level: number;
    reasons: string[];
    note: string | null;
    created_at: string;
    nurse?: { id: string; full_name: string } | null;
  } | null;
  ack_by?: { id: string; full_name: string } | null;
  assess_by?: { id: string; full_name: string } | null;
}

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
  /** Class suggested at send time. Null also covers low findings with no class. */
  recommended_class_id: string | null;
  recommended_class?: { label: string; source: string | null } | null;
  recommended_band: Recommendation["band"] | null;
  recommendation_rules_version: string | null;
  nurse_action: NurseAction;
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

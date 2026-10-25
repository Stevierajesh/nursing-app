import type { Patient } from "./types";

export type PatientSort = "risk" | "worry" | "bed" | "alphabetical" | "criticality" | "emergency";
export type UnitNames = Readonly<Record<string, string>>;
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function patientLocation(p: Pick<Patient, "bed" | "room">): string {
  return [p.bed ? `Bed ${p.bed}` : null, p.room ? `Room ${p.room}` : null].filter(Boolean).join(" · ") || "No bed or room assigned";
}

function bedOrder(a: Patient, b: Patient): number {
  if (a.bed && !b.bed) return -1;
  if (!a.bed && b.bed) return 1;
  return natural.compare(a.bed ?? a.room ?? "\uffff", b.bed ?? b.room ?? "\uffff")
    || natural.compare(a.room ?? "\uffff", b.room ?? "\uffff")
    || natural.compare(a.display_name, b.display_name);
}

function escalationRank(p: Patient): number {
  const status = p.open_escalation?.status;
  return status === "auto_escalated" ? 0 : status === "open" ? 1 : status === "acknowledged" ? 2 : 3;
}

/** Location grouping only; a risk score cannot establish an ICU admission. */
function emergencyUnitRank(p: Patient, units: UnitNames): number {
  const name = p.unit_id ? units[p.unit_id] : undefined;
  if (!name) return 2;
  return /\b(icu|micu|sicu|picu|nicu|cicu|cvicu|neuroicu|intensive care|critical care|emergency|ed|er|a&e)\b/i.test(name) ? 0 : 1;
}

export function sortPatients(patients: Patient[], sort: PatientSort, units: UnitNames = {}): Patient[] {
  return [...patients].sort((a, b) => {
    if (sort === "alphabetical") return natural.compare(a.display_name, b.display_name) || bedOrder(a, b);
    if (sort === "criticality") return escalationRank(a) - escalationRank(b) || b.risk_score - a.risk_score || bedOrder(a, b);
    if (sort === "emergency") return emergencyUnitRank(a, units) - emergencyUnitRank(b, units) || b.risk_score - a.risk_score || bedOrder(a, b);
    if (sort === "risk") return b.risk_score - a.risk_score || bedOrder(a, b);
    if (sort === "worry") return (b.latest_worry?.level ?? -1) - (a.latest_worry?.level ?? -1) || b.risk_score - a.risk_score || bedOrder(a, b);
    return bedOrder(a, b);
  });
}

export function priorityPatients(patients: Patient[]): Patient[] {
  return sortPatients(patients, "criticality").slice(0, 3);
}

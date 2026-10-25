import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, ErrorNote, Spinner } from "../components/Primitives";
import PatientRow from "../components/PatientRow";
import { usePatients } from "../lib/patients";
import { patientLocation, sortPatients, type PatientSort } from "../lib/patientOrder";
import { REASON_LABELS, type Patient } from "../lib/types";

const SORTS: { value: PatientSort; label: string }[] = [
  { value: "alphabetical", label: "Name A–Z" },
  { value: "criticality", label: "Criticality" },
  { value: "emergency", label: "Emergency / ICU" },
  { value: "risk", label: "Risk score" },
  { value: "worry", label: "Nurse worry" },
  { value: "bed", label: "Bed #" },
];

/*
 * Matched against the same strings the row renders, so a nurse never gets an
 * empty result for something they can see on screen. Name is included even
 * though the placeholder does not advertise it -- typing a patient's name and
 * getting nothing back would read as a broken search.
 */
function matchesQuery(p: Patient, query: string, unitName: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [
    patientLocation(p),
    p.display_name,
    unitName,
    ...(p.latest_worry?.reasons.map((r) => REASON_LABELS[r]) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every(term => text.includes(term));
}

export default function MyPatients() {
  const { patients, loading, error } = usePatients();
  const [sort, setSort] = useState<PatientSort>("risk");
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [unitError, setUnitError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => api.get<{ units: { id: string; name: string }[] }>("/api/v1/admin/units")
      .then(data => { if (active) { setUnits(data.units); setUnitError(""); } })
      .catch(() => { if (active) setUnitError("Wing/unit names could not be loaded. Patient search and other sorting remain available."); });
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  if (loading) return <Spinner label="Loading your patients" />;
  const unitNames = Object.fromEntries(units.map(u => [u.id, u.name]));
  const assignedUnits = new Set(patients.map(p => p.unit_id));
  const shown = sortPatients(patients.filter(p =>
    (!unitFilter || (unitFilter === "__unassigned__" ? !p.unit_id : p.unit_id === unitFilter)) &&
    matchesQuery(p, query, p.unit_id ? unitNames[p.unit_id] ?? "" : "Unassigned unit")
  ), sort, unitNames);
  return (
    <div className="flex flex-col gap-5 p-4">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight">Patients</h1>
        <p className="mt-2 text-sm text-ink-400">Risk score 1–10: vitals plus nurse worry</p>
      </header>
      {error && <ErrorNote>{error}</ErrorNote>}
      {unitError && <ErrorNote>{unitError}</ErrorNote>}
      <div className="flex min-h-14 items-center gap-3 rounded-full border border-ink-600 bg-ink-800 px-5">
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-5 shrink-0 text-ink-400">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search patients"
          placeholder="Search name, wing, room or reason"
          className="min-h-12 w-full bg-transparent text-sm placeholder:text-ink-400 focus:outline-none"
        />
      </div>
      <label className="block text-sm text-ink-200 sm:max-w-sm">
        Wing / unit
        <select aria-label="Filter by wing or unit" value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-800 px-3">
          <option value="">All assigned wings / units</option>
          {units.filter(u => assignedUnits.has(u.id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          {[...assignedUnits].filter((id): id is string => !!id && !unitNames[id]).map(id => <option key={id} value={id}>Unit name unavailable</option>)}
          {assignedUnits.has(null) && <option value="__unassigned__">Unassigned unit</option>}
        </select>
      </label>
      <div role="group" aria-label="Sort patients" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 shrink-0 text-xs text-ink-400">Sort by</span>
        {SORTS.map(s => <button key={s.value} onClick={() => setSort(s.value)} aria-pressed={sort === s.value} className={`min-h-11 rounded-full border px-4 text-xs font-semibold transition sm:px-5 ${sort === s.value ? "border-accent bg-accent text-white" : "border-ink-600 bg-ink-800 text-ink-200"}`}>{s.label}</button>)}
      </div>
      {sort === "alphabetical" && <p className="text-xs text-ink-400">Patient names in A–Z order.</p>}
      {sort === "criticality" && <p className="text-xs text-ink-400">Overdue escalations first, then open, acknowledged, and other patients. Higher risk scores come first within each group.</p>}
      {sort === "emergency" && <p className="text-xs text-ink-400">Patients assigned to emergency or intensive care units first, then other units, then unknown locations. Higher risk comes first within each group. This uses unit names and does not indicate a need for ICU admission.</p>}
      {sort === "bed" && <p className="text-xs text-ink-400">Beds in ascending order. Patients without a bed follow, ordered by room.</p>}
      {patients.length === 0 && !error && <Card>No patients assigned. Ask the charge nurse to add you to this shift.</Card>}
      {patients.length > 0 && <p role="status" className="text-xs text-ink-400">Showing {shown.length} of {patients.length} assigned patients</p>}
      {patients.length > 0 && shown.length === 0 && <Card>No patients match the selected search and wing/unit filter.</Card>}
      <ul aria-label="Patients" className="md:grid md:grid-cols-2 md:gap-x-6">{shown.map(p => <PatientRow key={p.id} patient={p} unitName={p.unit_id ? unitNames[p.unit_id] : "Unassigned unit"} />)}</ul>
    </div>
  );
}

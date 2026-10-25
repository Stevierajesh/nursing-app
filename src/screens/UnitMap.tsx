import ClinicalPriority from "../components/ClinicalPriority";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { patientLocation, sortPatients } from "../lib/patientOrder";
import { RISK_BANDS } from "../lib/risk";
import { REASON_LABELS, WORRY_LABELS } from "../lib/types";
import type { Unit, UnitBed } from "../lib/mobileTypes";
import { Button, Card, ErrorNote, Spinner } from "../components/Primitives";
import UnitFloorPlan from "../components/UnitFloorPlan";

export default function UnitMap() {
  const { me } = useAuth();
  const {
    patients,
    loading: patientsLoading,
    error: patientsError,
    refresh,
  } = usePatients();
  const [beds, setBeds] = useState<UnitBed[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [bedId, setBedId] = useState("current");
  const [room, setRoom] = useState("");
  const [bedName, setBedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const load = useCallback(async () => {
    try {
      const [b, u] = await Promise.all([
        api.get<{ beds: UnitBed[] }>("/api/v1/beds"),
        api.get<{ units: Unit[] }>("/api/v1/admin/units"),
      ]);
      setBeds(b.beds);
      setUnits(u.units);
      setError(null);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load unit map");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  const currentUnit =
    units.find((u) => u.id === (unitId || me?.unit?.id)) ?? units[0];
  const unitBeds = beds
    .filter((b) => b.unit_id === currentUnit?.id)
    .sort(
      (a, b) =>
        a.room.localeCompare(b.room, undefined, { numeric: true }) ||
        a.bed.localeCompare(b.bed, undefined, { numeric: true }),
    );
  const selected = unitBeds.find((b) => b.id === selectedId);
  const patientAt = (b: UnitBed) =>
    patients.find((p) => p.unit_id === b.unit_id && p.bed === b.bed);
  const selectedPatient = selected ? patientAt(selected) : undefined;
  const canEdit = me?.user.role === "admin" || me?.user.role === "charge_nurse";
  const editingPatient =
    patients.find((p) => p.id === patientId) ??
    sortPatients(patients, "bed")[0];
  const currentBed = beds.find(
    (b) =>
      b.unit_id === editingPatient?.unit_id && b.bed === editingPatient?.bed,
  );
  const assignmentBedId = bedId === "current" ? (currentBed?.id ?? "") : bedId;
  async function saveLocation() {
    if (!editingPatient || busy) return;
    setBusy(true);
    setMessage("");
    setError(null);
    try {
      await api.patch(`/api/v1/patients/${editingPatient.id}/location`, {
        bed_id: assignmentBedId || null,
      });
      await Promise.all([refresh(), load()]);
      setMessage("Bed assignment saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save assignment");
    } finally {
      setBusy(false);
    }
  }
  async function createBed() {
    if (!currentUnit || busy) return;
    setBusy(true);
    setMessage("");
    setError(null);
    try {
      await api.post("/api/v1/beds", {
        unit_id: currentUnit.id,
        room: room.trim(),
        bed: bedName.trim(),
      });
      setRoom("");
      setBedName("");
      await load();
      setMessage("Bed added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add bed");
    } finally {
      setBusy(false);
    }
  }
  if (loading || patientsLoading) return <Spinner label="Loading unit map" />;
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {unitBeds.length > 0 && <UnitFloorPlan
        unitName={currentUnit?.name ?? ""}
        beds={unitBeds}
        patientAt={patientAt}
        selectedId={selectedId}
        onSelect={(bed) => { setSelectedId(bed.id); setEditing(false); }}
      />}
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 w-[min(20rem,calc(100%_-_2rem))] rounded-2xl border border-white/70 bg-white/70 p-2 shadow-lg shadow-ink-200/5 backdrop-blur-md">
        <select
          aria-label="Map unit"
          value={currentUnit?.id ?? ""}
          onChange={(e) => {
            setUnitId(e.target.value);
            setSelectedId("");
            setEditing(false);
            setBedId("current");
            setMessage("");
          }}
          className="min-h-12 w-full rounded-xl border border-ink-600/60 bg-white/30 px-3 text-sm font-semibold"
        >
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex items-center justify-between gap-2 px-2 text-xs text-ink-400">
          <span className="flex items-center gap-1.5" title={updatedAt ? `Updated ${updatedAt}` : "No update yet"}>
            <span className="size-1.5 rounded-full bg-calm" aria-hidden />Live
          </span>
          <div className="flex gap-2">
            {canEdit && <button className="min-h-11 px-2 text-accent" onClick={() => { setEditing(!editing); setMessage(""); }}>Edit beds</button>}
            <button onClick={() => void Promise.all([load(), refresh()])} className="min-h-11 px-2 text-accent">Refresh</button>
          </div>
        </div>
        {(error || patientsError) && <ErrorNote>{error || patientsError}</ErrorNote>}
        {unitBeds.length === 0 && <p className="p-2 text-sm text-ink-400">No beds configured for this unit.{canEdit ? " Open the bed editor to add rooms." : ""}</p>}
      </div>
      {(selected || editing) && <section aria-label="Room details and bed editor" className="absolute bottom-28 left-4 right-20 z-10 max-h-[min(55dvh,36rem)] space-y-3 overflow-y-auto rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur-md sm:left-auto sm:w-96">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-400">{editing ? "Bed editor" : "Room details"}</span>
          <button aria-label="Close map details" className="min-h-11 px-3 text-sm text-accent" onClick={() => { setSelectedId(""); setEditing(false); }}>Close</button>
        </div>
      {selected && (
        <Card>
          <h2 className="font-semibold">
            Room {selected.room} · Bed {selected.bed}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {unitBeds.filter((bed) => bed.room === selected.room).map((bed) => <button key={bed.id} aria-pressed={bed.id === selectedId} onClick={() => setSelectedId(bed.id)} className={`min-h-11 rounded-xl border px-3 text-xs ${bed.id === selectedId ? "border-accent bg-accent/10 text-accent" : "border-ink-600"}`}>Bed {bed.bed}</button>)}
          </div>
          {selectedPatient ? (
            <>
              <p className="mt-2">{selectedPatient.display_name}</p>
              <ClinicalPriority patient={selectedPatient} />
              <p className="mt-1 text-sm text-ink-400">
                {selectedPatient.latest_worry
                  ? WORRY_LABELS[selectedPatient.latest_worry.level]
                  : "No worry recorded"}
                {selectedPatient.latest_worry?.reasons.length
                  ? ` · ${selectedPatient.latest_worry.reasons.map((r) => REASON_LABELS[r]).join(", ")}`
                  : ""}
              </p>
              <Link
                to={
                  selectedPatient.open_escalation
                    ? `/respond/${selectedPatient.id}`
                    : `/worry/${selectedPatient.id}`
                }
                className="mt-4 inline-block rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white"
              >
                {selectedPatient.open_escalation ? "Respond" : "Open patient"}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-400">
              {selected.occupied
                ? "Occupied · outside your active patient list"
                : "Vacant"}
            </p>
          )}
        </Card>
      )}
      {selected && <p className="text-xs text-ink-400">Red: unresolved escalation or NEWS high. NEWS warnings take priority over the combined score.</p>}
      {selected && <div aria-label="Combined score legend" className="flex flex-wrap gap-1.5">{RISK_BANDS.map((band) => <span key={band.label} className={`rounded-full border px-2 py-1 text-[10px] ${band.tint} ${band.text}`}>{band.range} {band.label}</span>)}</div>}
      {canEdit && (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(!editing);
              setMessage("");
            }}
          >
            {editing ? "Close bed editor" : "Edit beds"}
          </Button>
          {editing && (
            // Form fields stay at a readable measure instead of spanning the
            // full tablet shell.
            <Card className="space-y-4 sm:max-w-xl">
              <h2 className="text-lg font-semibold">Bed assignments</h2>
              <label className="block text-sm">
                Patient
                <select
                  aria-label="Assignment patient"
                  value={editingPatient?.id ?? ""}
                  onChange={(e) => {
                    setPatientId(e.target.value);
                    setBedId("current");
                  }}
                  className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3"
                >
                  {sortPatients(patients, "bed").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} · {patientLocation(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Assign bed
                <select
                  aria-label="Assign bed"
                  value={assignmentBedId}
                  onChange={(e) => setBedId(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3"
                >
                  <option value="">Clear bed assignment</option>
                  {beds
                    .filter(
                      (b) =>
                        b.unit_id === currentUnit?.id ||
                        b.id === currentBed?.id,
                    )
                    .map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        disabled={
                          b.occupied && patientAt(b)?.id !== editingPatient?.id
                        }
                      >
                        Room {b.room} · Bed {b.bed}
                        {b.occupied ? " · occupied" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                disabled={busy || !editingPatient}
                onClick={() => void saveLocation()}
              >
                Save assignment
              </Button>
              <h3 className="border-t border-ink-600 pt-4 font-semibold">
                Add bed to {currentUnit?.name}
              </h3>
              <label className="block text-sm">
                Room
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  maxLength={40}
                  className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3"
                />
              </label>
              <label className="block text-sm">
                Bed identifier
                <input
                  value={bedName}
                  onChange={(e) => setBedName(e.target.value)}
                  maxLength={40}
                  className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3"
                />
              </label>
              <Button
                disabled={
                  busy || !room.trim() || !bedName.trim() || !currentUnit
                }
                onClick={() => void createBed()}
              >
                Add bed
              </Button>
            </Card>
          )}
          {message && (
            <p role="status" className="text-sm text-calm">
              {message}
            </p>
          )}
        </>
      )}
      </section>}
    </div>
  );
}

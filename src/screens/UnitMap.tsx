import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePatients } from "../lib/patients";
import { patientLocation, sortPatients } from "../lib/patientOrder";
import { RISK_BANDS, riskBand, riskOutOfTen, riskTone } from "../lib/risk";
import { REASON_LABELS, WORRY_LABELS } from "../lib/types";
import type { Unit, UnitBed } from "../lib/mobileTypes";
import { Button, Card, ErrorNote, Spinner } from "../components/Primitives";

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
    <div className="space-y-5 p-4">
      <h1 className="text-4xl font-extrabold tracking-tight">Unit map</h1>
      <p className="text-sm text-ink-400">
        Rooms, bed occupancy, and patient risk
      </p>
      {(error || patientsError) && (
        <ErrorNote>{error || patientsError}</ErrorNote>
      )}
      <label className="block text-sm text-ink-200 sm:max-w-sm">
        Unit
        <select
          aria-label="Map unit"
          value={currentUnit?.id ?? ""}
          onChange={(e) => {
            setUnitId(e.target.value);
            setSelectedId("");
            setBedId("current");
            setMessage("");
          }}
          className="mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-800 px-3"
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-400">
        <span className="flex items-center gap-2">
          {updatedAt && (
            <span className="size-2 shrink-0 rounded-full bg-calm" aria-hidden />
          )}
          {updatedAt ? `Live · updated ${updatedAt}` : "No update yet"}
        </span>
        <button
          onClick={() => void Promise.all([load(), refresh()])}
          className="min-h-11 px-3 text-accent"
        >
          Refresh
        </button>
      </div>
      {unitBeds.length === 0 ? (
        <Card>
          No beds configured for this unit.
          {canEdit ? " Open the bed editor to add rooms." : ""}
        </Card>
      ) : (
        <>
          <div className="rounded-3xl border border-ink-600 bg-ink-800 p-3">
            <p className="mb-4 text-center text-xs uppercase tracking-widest text-ink-400">
              {currentUnit?.name} · Unit overview
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {unitBeds.map((b) => {
                const p = patientAt(b);
                const band = p ? riskBand(p.risk_score) : null;
                return (
                  <button
                    key={b.id}
                    aria-pressed={selectedId === b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`min-h-28 rounded-xl border p-2 text-center ${band ? `${band.tint} ${band.text}` : "border-ink-600 bg-ink-900 text-ink-400"} ${selectedId === b.id ? "ring-2 ring-accent" : ""}`}
                  >
                    <span className="block text-xs text-ink-400">
                      Room {b.room}
                    </span>
                    <span className="block text-xs">Bed {b.bed}</span>
                    {band && p ? (
                      <>
                        {/* Pale cell, stronger circle: the mockups use the ring
                            of colour to carry the number across the room. */}
                        <span
                          className={`mx-auto mt-2 flex size-10 items-center justify-center rounded-full text-base font-bold tabular-nums text-ink-200 ${band.dot}`}
                        >
                          {riskOutOfTen(p.risk_score)}
                        </span>
                        <span className="mt-1 block text-xs font-semibold">
                          {band.label}
                        </span>
                      </>
                    ) : (
                      <span className="mt-2 block text-lg font-bold">
                        {b.occupied ? "Occupied" : "Vacant"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl border border-ink-600 bg-ink-900 py-3 text-center text-xs text-ink-400">
              Nurses’ station
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {RISK_BANDS.map((b) => (
              <span
                key={b.label}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.tint} ${b.text}`}
              >
                {b.range} {b.label}
              </span>
            ))}
          </div>
        </>
      )}
      {selected && (
        <Card>
          <h2 className="font-semibold">
            Room {selected.room} · Bed {selected.bed}
          </h2>
          {selectedPatient ? (
            <>
              <p className="mt-2">{selectedPatient.display_name}</p>
              <p
                className={`mt-1 font-bold ${riskTone(selectedPatient.risk_score)}`}
              >
                Risk {riskOutOfTen(selectedPatient.risk_score)}/10
              </p>
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
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Unit, UnitBed } from "../lib/mobileTypes";
import { Button, Card, ErrorNote } from "./Primitives";

const INPUT = "mt-2 min-h-12 w-full rounded-xl border border-ink-600 bg-ink-800 px-3 text-sm focus:border-accent focus:outline-none";

export default function NewPatientForm({ units, onCreated, onCancel }: {
  units: Unit[];
  onCreated: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { me } = useAuth();
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [bedId, setBedId] = useState("");
  const [beds, setBeds] = useState<UnitBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const selectedUnitId = unitId || units.find(u => u.id === me?.unit?.id)?.id || units[0]?.id || "";

  async function refreshBeds() {
    try {
      const data = await api.get<{ beds: UnitBed[] }>("/api/v1/beds");
      setBeds(data.beds);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load available beds");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refreshBeds(); }, []);

  const available = beds.filter(b => b.unit_id === selectedUnitId && !b.occupied)
    .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }) || a.bed.localeCompare(b.bed, undefined, { numeric: true }));
  const validBed = !bedId || available.some(b => b.id === bedId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim() || !selectedUnitId || !validBed || loading || loadError) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/api/v1/patients", { display_name: name.trim(), unit_id: selectedUnitId, bed_id: bedId || null });
      await onCreated(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create patient");
      await refreshBeds();
    } finally {
      setBusy(false);
    }
  }

  return <Card>
    <h2 className="text-lg font-semibold">New patient</h2>
    <p className="mt-1 text-sm text-ink-400">Add a patient and choose an available bed. {me?.user.role === "nurse" ? "They’ll be assigned to you and added to your Risk list." : "They’ll appear in Patients and the Risk list."}</p>
    <p className="mt-2 text-xs text-ink-400">Stable simulated vitals start automatically at normal baseline values and update every 15 seconds.</p>
    {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    {loadError && <div className="mt-3"><ErrorNote>{loadError}</ErrorNote><button type="button" onClick={() => { setLoading(true); void refreshBeds(); }} className="min-h-11 text-sm font-semibold text-accent">Retry loading beds</button></div>}
    <form onSubmit={submit} className="mt-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Patient name
          <input autoFocus required maxLength={200} autoComplete="off" value={name} onChange={e => setName(e.target.value)} className={INPUT} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Wing / unit
            <select required value={selectedUnitId} onChange={e => { setUnitId(e.target.value); setBedId(""); }} className={INPUT}>
              {!units.length && <option value="">No units available</option>}
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Bed
            <select value={validBed ? bedId : ""} disabled={loading || !!loadError} onChange={e => { setBedId(e.target.value); setError(""); }} className={INPUT}>
              <option value="">{loading ? "Loading beds…" : "Assign a bed later"}</option>
              {available.map(b => <option key={b.id} value={b.id}>Room {b.room} · Bed {b.bed}</option>)}
            </select>
            {!loading && !loadError && !available.length && <p className="mt-1 text-xs text-ink-400">No available beds in this unit. You can still add the patient.</p>}
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading || !!loadError || !selectedUnitId || !name.trim() || !validBed}>{busy ? "Adding patient…" : "Add patient"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </fieldset>
    </form>
  </Card>;
}

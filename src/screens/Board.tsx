import { useState } from "react";
import { Card, ErrorNote, Spinner } from "../components/Primitives";
import { usePatients } from "../lib/patients";
import { patientLocation } from "../lib/patientOrder";
import WorryTap from "./WorryTap";

export default function Board() {
  const { patients, loading, error } = usePatients();
  const [selectedId, setSelectedId] = useState("");
  const selected = patients.find(p => p.id === selectedId) ?? patients[0];
  if (loading) return <Spinner label="Loading the board" />;
  return (
    <div className="flex flex-col gap-4 p-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      {patients.length === 0 && !error ? <Card>No patients assigned. Ask the charge nurse to add you to this shift.</Card> : selected && (
        <section aria-label="Input nurse score">
          <Card className="rounded-3xl">
            {/* The card lays out in two columns on a wide screen: patient and
                observations left, the tap right. WorryTap owns that grid --
                it holds the capture state, so splitting it across two
                instances would split the state with it. */}
            <WorryTap
              key={selected.id}
              patientId={selected.id}
              embedded
              header={
                <div>
                  <h2 className="mb-4 text-lg font-semibold">Input nurse score for existing patient?</h2>
                  {/* One pill, label left and value right, per the mockup. The
                      select keeps its native control -- on a phone that is the
                      OS wheel, and a custom listbox would be a worse target in
                      a corridor. */}
                  <div className="flex min-h-14 items-center gap-3 rounded-full border border-ink-600 bg-ink-800 px-5">
                    <label htmlFor="board-patient" className="shrink-0 text-sm text-ink-400">Patient</label>
                    <select id="board-patient" value={selected.id} onChange={e => setSelectedId(e.target.value)} className="min-h-12 w-full appearance-none truncate bg-transparent text-right text-sm font-semibold focus:outline-none">
                      {patients.map(p => <option key={p.id} value={p.id}>{patientLocation(p)} · {p.display_name}</option>)}
                    </select>
                  </div>
                </div>
              }
            />
          </Card>
        </section>
      )}
    </div>
  );
}

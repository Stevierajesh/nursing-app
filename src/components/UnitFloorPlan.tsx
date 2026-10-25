import MapViewport from "./MapViewport";
import type { UnitBed } from "../lib/mobileTypes";
import type { Patient } from "../lib/types";
import { patientPriority, riskOutOfTen } from "../lib/risk";

interface Props {
  unitName: string;
  beds: UnitBed[];
  patientAt: (bed: UnitBed) => Patient | undefined;
  selectedId: string;
  onSelect: (bed: UnitBed) => void;
}

// Coordinates refer to the two 1536 × 1024 floor plan assets. Room identities
// come exclusively from the API; the illustration's sample labels are covered.
export default function UnitFloorPlan({ unitName, beds, patientAt, selectedId, onSelect }: Props) {
  const north = /^6\s*North/i.test(unitName);
  const supported = north || /^4\s*West/i.test(unitName);
  const columns = north ? 4 : 6;
  const rooms = [...new Set(beds.map((bed) => bed.room))].map((room) => ({
    room,
    beds: beds.filter((bed) => bed.room === room),
  }));
  // Shared rooms fit the upper row; single rooms fit the lower row.
  const ordered = [...rooms].sort((a, b) => b.beds.length - a.beds.length || a.room.localeCompare(b.room, undefined, { numeric: true }));
  const mapped = supported ? ordered.slice(0, columns * 2) : [];
  const additional = supported ? ordered.slice(columns * 2) : ordered;

  function isHighRisk(roomBeds: UnitBed[]) {
    return roomBeds.some(bed => {
      const patient = patientAt(bed);
      return patient && patientPriority(patient).rank === 3;
    });
  }

  function bedButton(bed: UnitBed) {
    const patient = patientAt(bed);
    const priority = patient ? patientPriority(patient) : null;
    const band = priority?.band;
    const status = band && patient ? `${priority!.label} · Combined ${riskOutOfTen(patient.risk_score)}/10` : bed.occupied ? "Occupied" : "Vacant";
    return (
      <button
        key={bed.id}
        aria-label={`Room ${bed.room}, bed ${bed.bed}, ${status}`}
        aria-pressed={selectedId === bed.id}
        title={priority?.reason}
        onClick={() => onSelect(bed)}
        className={`min-h-11 max-w-40 rounded-lg border-2 px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${band ? `${band.tint.replace("/30", "/70")} ${band.text}` : "border-ink-400 bg-white text-ink-400"} ${selectedId === bed.id ? "ring-2 ring-accent" : ""}`}
      >
        <span className="block font-semibold">Bed {bed.bed}</span>
        <span className="block">{status}</span>
      </button>
    );
  }

  return (
    <div className="absolute inset-0">
      {supported && <>
        <MapViewport key={unitName} label={`${unitName} interactive floor plan. Drag to pan, use zoom controls or arrow keys.`}>
          <div className="relative h-full w-full bg-[#f0f0f0]">
            <img src={`/floorplans/${north ? "6-north" : "4-west"}-minimal.png`} alt="" className="absolute inset-0 h-full w-full mix-blend-multiply" draggable={false} />
            {Array.from({ length: columns * 2 }, (_, index) => {
              const room = mapped[index];
              const top = index < columns;
              const column = index % columns;
              const left = north ? 7 + column * 21.75 : 3.25 + column * 15.72;
              const width = north ? 20.7 : 14.9;
              const active = room?.beds.some((bed) => bed.id === selectedId);
              return <div key={index} className={`absolute ${room && isHighRisk(room.beds) ? "room-risk-high" : ""}`} style={{ left: `${left}%`, width: `${width}%`, top: `${top ? north ? 16.8 : 19 : north ? 71 : 71.2}%`, height: `${top ? 21 : 18.5}%` }}>
                <button
                  disabled={!room}
                  aria-label={room ? `Select room ${room.room}, ${room.beds.length} beds` : "Unconfigured room"}
                  aria-pressed={active ?? false}
                  onClick={() => room && onSelect(room.beds[0])}
                  className={`absolute inset-0 rounded-md border-[3px] border-ink-400 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${room && isHighRisk(room.beds) ? "border-very" : ""} ${active ? "bg-accent/5 ring-2 ring-accent" : "hover:bg-accent/5"}`}
                />
                <span className="pointer-events-none absolute bg-[#f0f0f0] py-2 text-center text-sm font-medium text-ink-400" style={{
                  top: top ? north ? "68%" : "56%" : north ? "53%" : "17%",
                  left: !top && north ? column === 3 ? "0%" : "40%" : "0%",
                  width: !top && north ? "58%" : "100%",
                }}>
                  {room ? `Room ${room.room}` : "Unconfigured"}
                </span>
                {room && <div className="pointer-events-none absolute flex justify-around gap-1" style={{
                  top: top ? "20%" : north ? "24%" : "54%",
                  left: !top && north ? column === 3 ? "55%" : "12%" : "2%",
                  right: !top && north ? column === 3 ? "2%" : "55%" : "2%",
                }}>
                  {room.beds.slice(0, 2).map((bed) => <div className="pointer-events-auto" key={bed.id}>{bedButton(bed)}</div>)}
                </div>}
              </div>;
            })}
          </div>
        </MapViewport>
      </>}
      {additional.length > 0 && <div className="absolute bottom-28 left-4 z-10 max-h-48 max-w-[70vw] overflow-auto rounded-2xl border border-ink-600 bg-white/80 p-3 backdrop-blur-md">
        <h2 className="mb-3 text-sm font-semibold">{supported ? "Additional rooms" : "Rooms"}</h2>
        <div className="flex flex-wrap gap-3">{additional.map((room) => <div key={room.room} className={`relative rounded-lg border-2 border-ink-400 p-2 ${isHighRisk(room.beds) ? "room-risk-high" : ""}`}>
          <p className="mb-2 text-xs text-ink-400">Room {room.room}</p>
          <div className="flex flex-wrap gap-2">{room.beds.map(bedButton)}</div>
        </div>)}</div>
      </div>}
    </div>
  );
}

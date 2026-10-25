import { useEffect, useRef, useState, type ReactNode } from "react";

export default function MapViewport({ children, label }: { children: ReactNode; label: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const constrain = (next: typeof view) => {
    const bounds = viewport.current?.getBoundingClientRect();
    const zoom = Math.max(0.4, Math.min(2.5, next.zoom));
    const maxX = Math.max(0, (1536 * zoom - (bounds?.width ?? 0)) / 2);
    const maxY = Math.max(0, (1024 * zoom - (bounds?.height ?? 0)) / 2);
    return { zoom, x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  };
  const reset = () => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (bounds) setView({ x: 0, y: 0, zoom: Math.max(bounds.width / 1536, bounds.height / 1024) * 1.3 });
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      setView({ x: 0, y: 0, zoom: Math.max(bounds.width / 1536, bounds.height / 1024) * 1.3 });
    });
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((previous) => constrain({ ...previous, zoom: previous.zoom * Math.exp(-event.deltaY * 0.002) }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener("wheel", wheel); };
  }, []);
  return <div className="absolute inset-0 overflow-hidden bg-[#f0f0f0]">
    <div ref={viewport} tabIndex={0} role="region" aria-label={label}
      className="absolute inset-0 cursor-grab overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        start.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        start.x = event.clientX; start.y = event.clientY;
        suppressClick.current = true;
        setView((previous) => constrain({ ...previous, x: previous.x + dx, y: previous.y + dy }));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; suppressClick.current = false; }}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const steps: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
        const step = steps[event.key];
        if (step) { event.preventDefault(); setView((previous) => constrain({ ...previous, x: previous.x + step[0], y: previous.y + step[1] })); }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); setView(previous => constrain({ ...previous, zoom: previous.zoom * 1.2 })); }
        if (event.key === '-') { event.preventDefault(); setView(previous => constrain({ ...previous, zoom: previous.zoom / 1.2 })); }
        if (event.key === 'Home') { event.preventDefault(); reset(); }
      }}>
      <div className="absolute left-1/2 top-1/2 select-none" data-map-canvas style={{ width: 1536, height: 1024, transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.zoom})`, transformOrigin: "center" }}>{children}</div>
    </div>
    <div className="absolute bottom-28 right-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-lg backdrop-blur-md" aria-label="Map controls">
      <button className="size-11 text-xl" aria-label="Zoom in" onClick={() => setView(previous => constrain({ ...previous, zoom: previous.zoom * 1.2 }))}>+</button>
      <button className="size-11 border-y border-ink-600/50 text-xl" aria-label="Zoom out" onClick={() => setView(previous => constrain({ ...previous, zoom: previous.zoom / 1.2 }))}>−</button>
      <button className="h-11 px-2 text-xs font-semibold" aria-label="Recenter map" onClick={reset}>Reset</button>
    </div>
  </div>;
}

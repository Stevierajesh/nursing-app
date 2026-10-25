/*
 * A trend line for one vital, sized for a card corner.
 *
 * Hand-rolled rather than pulled from a charting library: six of these appear
 * per approval review, none of them is interactive, and recharts would cost
 * more in bundle weight than the whole nurse app currently carries.
 *
 * Colour comes from `currentColor`, so the caller tints it with the same band
 * class that drives the badge and the two can never disagree.
 */
export default function Sparkline({
  values,
  label,
  className = "",
}: {
  values: (number | null)[];
  label: string;
  className?: string;
}) {
  const points = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  // One reading is a value, not a trend. Drawing a dot or a flat stub would
  // imply a history that was never charted.
  if (points.length < 2) return null;

  const width = 100;
  const height = 28;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min;

  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      // A perfectly steady vital has no span to scale against. Centre it:
      // normalising to 0 would pin the line to the floor of the box, and a
      // flat line along the bottom reads as "low" rather than "unchanged".
      const t = span === 0 ? 0.5 : (v - min) / span;
      const y = height - pad - t * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`h-7 w-full ${className}`}
      role="img"
      aria-label={label}
    >
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        // Keeps the stroke even after preserveAspectRatio="none" stretches
        // the viewBox to the card width.
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

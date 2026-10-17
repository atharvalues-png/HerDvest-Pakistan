/**
 * Server-rendered SVG of recorded weights. Actual measurements are a solid
 * line with points; a published estimate (if any) is a separate dashed segment
 * and is labelled as an estimate. No values are interpolated or invented.
 */
type Point = { date: string; kg: number };

export function WeightChart({ points, estimate }: { points: Point[]; estimate?: Point | null }) {
  const all = [...points, ...(estimate ? [estimate] : [])];
  if (points.length === 0) return null;
  const W = 640, H = 220, L = 48, R = 16, T = 16, B = 34;
  const t = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const tMin = Math.min(...all.map((p) => t(p.date)));
  const tMax = Math.max(...all.map((p) => t(p.date)));
  const kMin = Math.min(...all.map((p) => p.kg));
  const kMax = Math.max(...all.map((p) => p.kg));
  const pad = Math.max(10, (kMax - kMin) * 0.15);
  const lo = Math.max(0, Math.floor((kMin - pad) / 10) * 10);
  const hi = Math.ceil((kMax + pad) / 10) * 10;
  const x = (d: string) => (tMax === tMin ? L + (W - L - R) / 2 : L + ((t(d) - tMin) / (tMax - tMin)) * (W - L - R));
  const y = (kg: number) => T + (1 - (kg - lo) / (hi - lo || 1)) * (H - T - B);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const last = points[points.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`Recorded weights: ${points.map((p) => `${p.kg} kg on ${p.date}`).join("; ")}${estimate ? `. Estimate: ${estimate.kg} kg by ${estimate.date}` : ""}`}>
        {ticks.map((k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(k)} y2={y(k)} stroke="#123B2A" strokeOpacity="0.08" />
            <text x={L - 6} y={y(k) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{Math.round(k)}</text>
          </g>
        ))}
        <text x={8} y={T + 4} fontSize="10" fill="#6b7280">kg</text>
        {points.length > 1 && (
          <polyline fill="none" stroke="#1F7A55" strokeWidth="2.5" strokeLinejoin="round"
            points={points.map((p) => `${x(p.date)},${y(p.kg)}`).join(" ")} />
        )}
        {estimate && (
          <>
            <line x1={x(last.date)} y1={y(last.kg)} x2={x(estimate.date)} y2={y(estimate.kg)} stroke="#C6A35B" strokeWidth="2" strokeDasharray="6 5" />
            <circle cx={x(estimate.date)} cy={y(estimate.kg)} r="5" fill="white" stroke="#C6A35B" strokeWidth="2" />
            <text x={x(estimate.date)} y={y(estimate.kg) - 10} textAnchor="end" fontSize="11" fill="#8a6d2c">Estimate {estimate.kg} kg</text>
          </>
        )}
        {points.map((p) => (
          <g key={p.date + p.kg}>
            <circle cx={x(p.date)} cy={y(p.kg)} r="4" fill="#1F7A55" />
          </g>
        ))}
        {[points[0], ...(points.length > 1 ? [last] : []), ...(estimate ? [estimate] : [])].map((p, i) => (
          <text key={i} x={x(p.date)} y={H - 12} textAnchor="middle" fontSize="11" fill="#6b7280">{fmt(p.date)}</text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-emerald" /> Recorded measurements</span>
        {estimate && <span className="inline-flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-gold" /> Published estimate (not a measurement)</span>}
      </figcaption>
    </figure>
  );
}

"use client";
/**
 * SalesTrendChart — dependency-free inline SVG bar chart for the overview page.
 * Y scale is net sales in paise; x axis is one bar per day (hover shows exact values).
 */
import { formatINR } from "@/lib/format";

export interface TrendPoint {
  date: string;
  netSalesPaise: number;
  orders: number;
}

export function SalesTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink/50">No trend data for this range.</p>;
  }

  const max = Math.max(...points.map((p) => p.netSalesPaise), 1);
  const width = 720;
  const height = 200;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const slot = innerWidth / points.length;
  const barWidth = Math.max(3, Math.min(28, slot * 0.6));

  return (
    <figure className="px-4 pb-4 sm:px-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label={`Daily net sales over ${points.length} days; peak ${formatINR(max)}`}
      >
        {/* gridlines at 0 / half / max */}
        {[0, 0.5, 1].map((frac) => {
          const y = padding.top + innerHeight * (1 - frac);
          return (
            <g key={frac}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="stroke-sand" strokeWidth="1" />
              <text x={padding.left + 2} y={y - 3} className="fill-ink/40" fontSize="9">
                {formatINR(max * frac)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const barHeight = (p.netSalesPaise / max) * innerHeight;
          const x = padding.left + i * slot + (slot - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={p.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, p.netSalesPaise > 0 ? 2 : 0)}
                rx="2"
                className="fill-forest/85 hover:fill-forest"
              >
                <title>{`${p.date} · ${formatINR(p.netSalesPaise)} · ${p.orders} ${p.orders === 1 ? "order" : "orders"}`}</title>
              </rect>
              {i % Math.ceil(points.length / 8) === 0 ? (
                <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="fill-ink/45" fontSize="9">
                  {p.date.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-ink/50">
        Daily net sales (gross − discounts − refunds) for the selected range. Hover a bar for exact figures.
      </figcaption>
    </figure>
  );
}

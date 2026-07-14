/**
 * Small SVG chart set following the dataviz method: palette slots assigned in
 * fixed order via CSS custom properties (light/dark variants in styles.css),
 * thin marks with rounded data ends, hover tooltips, legends for >1 series.
 */
import { useState } from 'react';

const SERIES_VARS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
];

export interface BarDatum {
  label: string;
  value: number;
  detail?: string;
}

/** Single-series vertical bar chart (one hue; title carries identity). */
export function BarChart({
  data,
  height = 220,
  format,
}: {
  data: BarDatum[];
  height?: number;
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const pad = { top: 18, right: 8, bottom: 42, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const bw = innerW / data.length;
  const barW = Math.min(bw * 0.7, 48);
  const maxIdx = data.findIndex((d) => d.value === Math.max(...data.map((x) => x.value)));

  return (
    <div className="chart-root">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {/* baseline */}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          className="chart-axis"
        />
        {data.map((d, i) => {
          const h = max === 0 ? 0 : (d.value / max) * innerH;
          const x = pad.left + i * bw + (bw - barW) / 2;
          const y = pad.top + innerH - h;
          const showLabel = i === maxIdx || hover === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* generous hit target */}
              <rect x={pad.left + i * bw} y={pad.top} width={bw} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  d={roundedTopBar(x, y, barW, h, Math.min(4, h))}
                  fill={SERIES_VARS[0]}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {showLabel && d.value > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="chart-value">
                  {format(d.value)}
                </text>
              )}
              <text
                x={pad.left + i * bw + bw / 2}
                y={pad.top + innerH + 16}
                textAnchor="middle"
                className="chart-label"
              >
                {d.label}
              </text>
              {hover === i && d.detail && (
                <text
                  x={pad.left + i * bw + bw / 2}
                  y={pad.top + innerH + 32}
                  textAnchor="middle"
                  className="chart-detail"
                >
                  {d.detail}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

export interface DonutDatum {
  label: string;
  value: number;
}

/** Categorical composition donut with legend (slots in fixed order). */
export function Donut({
  data,
  format,
}: {
  data: DonutDatum[];
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 84;
  const rInner = 54;
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    return { d, i, a0, a1, frac };
  });
  const hovered = hover != null ? data[hover] : null;
  return (
    <div className="donut-root">
      <svg viewBox={`0 0 ${size} ${size}`} role="img">
        {arcs.map(({ d, i, a0, a1, frac }) =>
          frac <= 0 ? null : (
            <path
              key={i}
              d={arcPath(cx, cy, rInner, rOuter, a0, a1 - gapFor(frac))}
              fill={SERIES_VARS[i % SERIES_VARS.length]}
              opacity={hover === null || hover === i ? 1 : 0.4}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </path>
          ),
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" className="chart-value">
          {hovered ? format(hovered.value) : format(total)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="chart-detail">
          {hovered ? truncate(hovered.label, 16) : 'Total'}
        </text>
      </svg>
      <ul className="legend">
        {data.map((d, i) => (
          <li
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legend-swatch" style={{ background: SERIES_VARS[i % SERIES_VARS.length] }} />
            <span className="legend-label">{d.label}</span>
            <span className="legend-value">
              {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '–'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function gapFor(frac: number): number {
  // ~2px surface gap between segments, skipped for slivers
  return frac * Math.PI * 2 > 0.06 ? 0.025 : 0;
}

function arcPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return [
    `M ${p(r1, a0)}`,
    `A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}`,
    `L ${p(r0, a1)}`,
    `A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}`,
    'Z',
  ].join(' ');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

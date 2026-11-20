// Small hand-made charts: the hero's climbing line and per-coin sparklines. Pure SVG, no images.

/** A deterministic "price" walk that dips, ranges and then runs, drawn as a stepped line. */
export function HeroChart() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts: [number, number][] = [];
  let y = 520;
  for (let i = 0; i <= 60; i++) {
    const x = i * 24;
    const phase = i < 18 ? 0.3 : i < 34 ? -0.1 : 1.7; // drift, dip, run
    y -= phase * 6 + (rnd() - 0.5) * 34;
    y = Math.max(60, Math.min(600, y));
    pts.push([x, y]);
  }
  const step = pts.map(([x, yy], i) => (i ? `H${x} V${yy.toFixed(0)}` : `M${x} ${yy.toFixed(0)}`)).join(" ");
  const area = `${step} V640 H0 Z`;
  return (
    <svg className="hero-chart" viewBox="0 0 1440 640" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="#1d211d" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1440" height="640" fill="url(#grid)" />
      <path d={area} fill="#31e981" opacity="0.05" />
      <path className="line" d={step} fill="none" stroke="#31e981" strokeWidth="2.5" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="6" fill="#31e981" />
    </svg>
  );
}

export function Sparkline({ data, width = 96, height = 30, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  const clean = (data || []).filter((v) => isFinite(v) && v > 0);
  if (clean.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || max || 1;
  const pts = clean.map((v, i) => `${((i / (clean.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const up = clean[clean.length - 1] >= clean[0];
  const c = color || (up ? "var(--accent)" : "var(--red)");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

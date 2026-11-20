// Number formatting shared by client and server.
export function usd(n: number, digits = 1): string {
  if (!isFinite(n) || n <= 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(digits)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(digits)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(digits)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

export function price(n: number): string {
  if (!isFinite(n) || n <= 0) return "$0";
  if (n >= 1) return `$${n.toFixed(4)}`;
  const s = n.toFixed(14);
  const m = /^0\.(0+)(\d{0,4})/.exec(s);
  if (m && m[1].length >= 4) return `$0.0(${m[1].length})${m[2]}`;
  return `$${n.toPrecision(4)}`;
}

export function amount(n: number, digits = 4): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export const short = (a: string, n = 4) => (a && a.length > 2 * n + 1 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);

export function ago(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

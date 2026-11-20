// Token logos (and symbols) from Jupiter's public token API, cached for an hour.
const g = globalThis as any;
const cache: Map<string, { icon: string; symbol: string; at: number }> = (g.__runIcons ||= new Map());
const TTL = 3600_000;

export async function tokenInfo(mints: string[]): Promise<Record<string, { icon: string; symbol: string }>> {
  const now = Date.now();
  const out: Record<string, { icon: string; symbol: string }> = {};
  const need: string[] = [];
  for (const m of [...new Set(mints)]) {
    const c = cache.get(m);
    if (c && now - c.at < TTL) out[m] = { icon: c.icon, symbol: c.symbol };
    else need.push(m);
  }
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50);
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${chunk.join(",")}`, { next: { revalidate: 3600 } } as any);
      if (!r.ok) continue;
      const arr: any[] = await r.json();
      for (const t of arr || []) {
        if (!t?.id || !chunk.includes(t.id)) continue;
        const v = { icon: t.icon || "", symbol: t.symbol || "" };
        cache.set(t.id, { ...v, at: now });
        out[t.id] = v;
      }
    } catch {}
  }
  return out;
}

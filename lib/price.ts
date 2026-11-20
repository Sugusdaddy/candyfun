// USD prices from Jupiter's public price API (server side), cached for a minute.
const g = globalThis as any;
const cache: Map<string, { price: number; at: number }> = (g.__runPrice ||= new Map());
const TTL = 60_000;

export async function usdPrices(mints: string[]): Promise<Record<string, number>> {
  const now = Date.now();
  const out: Record<string, number> = {};
  const need: string[] = [];
  for (const m of [...new Set(mints)]) {
    const c = cache.get(m);
    if (c && now - c.at < TTL) out[m] = c.price;
    else need.push(m);
  }
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50);
    try {
      const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${chunk.join(",")}`, { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      for (const m of chunk) {
        const p = Number(j?.[m]?.usdPrice);
        if (p > 0) {
          cache.set(m, { price: p, at: now });
          out[m] = p;
        }
      }
    } catch {
      // stale prices are better than none
      for (const m of chunk) if (cache.has(m)) out[m] = cache.get(m)!.price;
    }
  }
  return out;
}

export async function usdPrice(mint: string): Promise<number> {
  return (await usdPrices([mint]))[mint] || 0;
}

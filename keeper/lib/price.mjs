// USD prices from Jupiter's public price API, cached briefly.
const cache = new Map();
const TTL = 60_000;

export async function usdPrices(mints) {
  const now = Date.now();
  const out = {};
  const need = [];
  for (const m of mints) {
    const c = cache.get(m);
    if (c && now - c.at < TTL) out[m] = c.price;
    else need.push(m);
  }
  for (let i = 0; i < need.length; i += 50) {
    const ids = need.slice(i, i + 50).join(",");
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`price API ${r.status}`);
    const j = await r.json();
    for (const m of need.slice(i, i + 50)) {
      const p = Number(j?.[m]?.usdPrice);
      if (p > 0) {
        cache.set(m, { price: p, at: now });
        out[m] = p;
      }
    }
  }
  return out;
}

export async function usdPrice(mint) {
  const p = (await usdPrices([mint]))[mint];
  if (!(p > 0)) throw new Error("no USD price for " + mint);
  return p;
}

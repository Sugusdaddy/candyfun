// Bundle check (Peak) and safety grade (higher.fun).
//
// Every wallet that bought in the first 20 slots is traced to the wallet that first funded it.
// An early buyer is linked when it is the launcher, was funded by the launcher, was funded by
// another early buyer, or shares a (non-exchange) funder with another early buyer. The grade adds
// snipers, the launcher selling and top-holder concentration.
import { CFG } from "./config.mjs";
import { K, kv, setJson } from "./kv.mjs";

const funderCache = new Map();
async function funder(wallet) {
  if (funderCache.has(wallet)) return funderCache.get(wallet);
  let out = { funder: null, exchange: false };
  if (CFG.heliusKey) {
    try {
      const r = await fetch(`https://api.helius.xyz/v1/wallet/${wallet}/funded-by?api-key=${CFG.heliusKey}`);
      if (r.ok) {
        const j = await r.json();
        out = { funder: j.funder || null, exchange: /exchange/i.test(j.funderType || "") };
      }
    } catch {}
  }
  funderCache.set(wallet, out);
  return out;
}

export async function bundleCheck(coin, holdersMap, supplyRaw, createSlot) {
  const early = ((await kv(["LRANGE", K.early(coin.mint), 0, 199])) || []).map((s) => JSON.parse(s));
  const byWallet = new Map();
  for (const t of early) if (!byWallet.has(t.w) || byWallet.get(t.w).slot > t.slot) byWallet.set(t.w, t);
  const buyers = [];
  for (const [wallet, t] of byWallet) {
    const f = await funder(wallet);
    buyers.push({ wallet, slot: createSlot ? t.slot - createSlot : 0, funder: f.funder, exchange: f.exchange });
  }
  const set = new Set(buyers.map((b) => b.wallet));
  const funderCount = new Map();
  for (const b of buyers) if (b.funder && !b.exchange) funderCount.set(b.funder, (funderCount.get(b.funder) || 0) + 1);
  const supply = Number(supplyRaw) || 1e15;
  const rows = buyers.map((b) => {
    let reason = null;
    if (b.wallet === coin.launcher) reason = "is the launcher";
    else if (b.funder === coin.launcher) reason = "funded by the launcher";
    else if (b.funder && set.has(b.funder)) reason = "funded by another early buyer";
    else if (b.funder && !b.exchange && funderCount.get(b.funder) > 1) reason = "shares a funder with another early buyer";
    const holds = Number(holdersMap?.get(b.wallet) || 0n);
    return { wallet: b.wallet, slot: b.slot, funder: b.funder, linked: !!reason, reason: reason || undefined, holdsPct: (holds / supply) * 100 };
  });
  rows.sort((a, b) => a.slot - b.slot);
  const linkedHoldPct = rows.filter((r) => r.linked).reduce((a, r) => a + r.holdsPct, 0);
  const snipers = rows.filter((r) => r.slot <= 1).length;

  const all = holdersMap ? [...holdersMap.values()].map(Number).sort((a, b) => b - a) : [];
  const top10Pct = (all.slice(0, 10).reduce((a, x) => a + x, 0) / supply) * 100;
  const launcherHolds = Number(holdersMap?.get(coin.launcher) || 0n);
  const launcherBought = early.filter((t) => t.w === coin.launcher).reduce((a, t) => a + Number(t.b), 0);
  const devSold = launcherBought > 0 && launcherHolds < launcherBought * 0.5;

  // Grade: start at 100 and take points off.
  let score = 100;
  const why = [];
  const linkedCount = rows.filter((r) => r.linked).length;
  if (linkedCount) {
    score -= Math.min(45, 15 + linkedCount * 6);
    why.push(`${linkedCount} linked early buyer${linkedCount > 1 ? "s" : ""}`);
  }
  if (linkedHoldPct > 5) {
    score -= Math.min(25, linkedHoldPct * 1.5);
    why.push(`linked wallets hold ${linkedHoldPct.toFixed(1)}%`);
  }
  if (snipers >= 3) {
    score -= Math.min(15, snipers * 2);
    why.push(`${snipers} block-0/1 snipers`);
  }
  if (devSold) {
    score -= 20;
    why.push("launcher sold");
  }
  if (top10Pct > 40) {
    score -= Math.min(25, (top10Pct - 40) * 0.8);
    why.push(`top 10 hold ${top10Pct.toFixed(0)}%`);
  }
  if (!why.length) why.push("no linked buyers, spread holders");
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";

  const result = { at: Date.now(), slots: CFG.bundleSlots, buyers: rows, linkedHoldPct, snipers, devSold, top10Pct, grade, gradeWhy: why };
  await setJson(K.bundle(coin.mint), result);
  return result;
}

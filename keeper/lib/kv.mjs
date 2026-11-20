// Same store and keys as the web (prefix `candy:`). Redis in production; for local runs the keeper
// can talk to the web's in-memory store through its dev-only bridge (KV_HTTP).
const P = process.env.KV_PREFIX || "candy:";
let client = null;

export async function kv(cmd) {
  // Inside the web's dev server with the in-memory store: share it.
  if (process.env.KV_MEMORY === "1") return (await import("../../lib/memkv.mjs")).memKv(cmd);
  if (process.env.REDIS_URL) {
    if (!client) {
      const { default: Redis } = await import("ioredis");
      client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3, connectTimeout: 8000 });
      client.on("error", () => {});
    }
    const [name, ...args] = cmd;
    const res = await client.call(String(name), ...args.map(String));
    if (String(name).toUpperCase() === "HGETALL" && res && !Array.isArray(res)) return Object.entries(res).flat();
    return res;
  }
  if (process.env.KV_HTTP) {
    const r = await fetch(process.env.KV_HTTP, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cmd) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  throw new Error("No KV: set REDIS_URL (or KV_HTTP for local runs)");
}

export async function getJson(key) {
  const s = await kv(["GET", key]);
  return s ? JSON.parse(s) : null;
}
export const setJson = (key, v) => kv(["SET", key, JSON.stringify(v)]);
export function hashObj(arr) {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

export const K = {
  coins: P + "coins",
  coin: (m) => `${P}coin:${m}`,
  market: (m) => `${P}market:${m}`,
  bundle: (m) => `${P}bundle:${m}`,
  rewards: (m) => `${P}rewards:${m}`, // display: fees this coin has sent to the pot, in pair units
  cursor: (m) => `${P}cursor:${m}`, // newest indexed signature
  trades: (m) => `${P}trades:${m}`, // list of recent trades JSON
  early: (m) => `${P}early:${m}`, // list of first-slot buys JSON
  feeAttr: (vault) => `${P}feeattr:${vault}`, // hash mint -> raw fee attributed since the last claim
  traderVol: (week) => `${P}tvol:${week}`, // hash wallet -> USD volume
  tradeCount: (hour) => `${P}tcount:${hour}`, // hash wallet -> trades in that hour (bot filter)
  bots: (week) => `${P}bots:${week}`, // hash wallet -> 1, left out of that week's airdrop
  quoteLedger: (q) => `${P}qledger:${q}`, // hash: pot -> raw amount of that token waiting for the airdrop
  payout: (week) => `${P}payout:${week}`, // the airdrop plan and its progress
  payouts: P + "payouts", // list of finished airdrops, newest first
  stats: P + "stats",
  feed: P + "feed",
  keeper: P + "keeper",
  tape: P + "tape", // global list of recent trades across coins
};

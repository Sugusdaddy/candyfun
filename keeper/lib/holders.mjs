// Holder snapshot of a coin via Helius DAS (owners aggregated), without pools, program-owned
// accounts and the fee wallet.
import { PublicKey } from "@solana/web3.js";
import { CFG, CPMM_AUTH, LAUNCHLAB_AUTH } from "./config.mjs";
import { conn, feeWallet } from "./solana.mjs";

const SYSTEM = "11111111111111111111111111111111";
const LOCK_AUTH = "3f7GcQFG397GAaEnv51zR6tsTVihYRydnydDD1BXZS37";

export async function holders(mint, extraExclude = []) {
  const exclude = new Set([LAUNCHLAB_AUTH, CPMM_AUTH, LOCK_AUTH, feeWallet?.publicKey.toBase58(), ...extraExclude].filter(Boolean));
  const map = new Map();
  let cursor;
  for (let page = 0; page < 100; page++) {
    const params = { mint, limit: 1000, options: { showZeroBalance: false } };
    if (cursor) params.cursor = cursor;
    let j;
    for (let a = 0; a < 5; a++) {
      const r = await fetch(CFG.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccounts", params }) });
      if (r.status === 429) {
        await new Promise((s) => setTimeout(s, 700 * (a + 1)));
        continue;
      }
      j = await r.json();
      break;
    }
    if (!j || j.error) throw new Error("DAS getTokenAccounts failed: " + JSON.stringify(j?.error || "429"));
    const accts = j.result?.token_accounts || [];
    for (const a of accts) {
      if (a.frozen || exclude.has(a.owner)) continue;
      const amt = BigInt(a.amount || 0);
      if (amt > 0n) map.set(a.owner, (map.get(a.owner) || 0n) + amt);
    }
    cursor = j.result?.cursor;
    if (!cursor || accts.length < 1000) break;
  }
  // Only real wallets: drop owners that are program accounts (pools, vault PDAs).
  const owners = [...map.keys()];
  for (let i = 0; i < owners.length; i += 100) {
    const chunk = owners.slice(i, i + 100);
    const infos = await conn.getMultipleAccountsInfo(chunk.map((o) => new PublicKey(o)));
    infos.forEach((info, k) => {
      if (info && info.owner.toBase58() !== SYSTEM) map.delete(chunk[k]);
    });
  }
  return map;
}

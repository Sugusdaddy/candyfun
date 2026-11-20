// Trade indexer: every new transaction on a coin's LaunchLab pool becomes a trade record.
//
// LaunchLab sends the platform fee to one vault per (platform, pair token). Each coin's share of a
// vault is attributed here, trade by trade (volume × 0.1%), for display. The same records give
// volume, last-trade time, the weekly trader volume the airdrop is paid against, the bot filter and
// the early buyers the bundle check needs.
import { PublicKey } from "@solana/web3.js";
import { getPdaLaunchpadVaultId, getPdaPlatformVault } from "@raydium-io/raydium-sdk-v2";
import { CFG, LAUNCHLAB_AUTH } from "./config.mjs";
import { K, kv } from "./kv.mjs";
import { call, getTx, txKeys } from "./solana.mjs";
import { LAUNCHPAD_PROGRAM } from "./launchlab.mjs";


export const platformVaultOf = (coin) => getPdaPlatformVault(LAUNCHPAD_PROGRAM, new PublicKey(coin.platformId), new PublicKey(coin.pair)).publicKey.toBase58();
export const weekKey = (t = Date.now()) => {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7; // Monday-based weeks
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};

/** Pull every signature newer than the cursor (oldest first). First run walks back to creation. */
async function newSignatures(poolId, cursor) {
  const out = [];
  let before;
  for (let page = 0; page < 20; page++) {
    const opts = { limit: 1000, commitment: "confirmed" };
    if (cursor) opts.until = cursor;
    if (before) opts.before = before;
    const batch = await call("getSignaturesForAddress", [poolId, opts]);
    out.push(...batch);
    if (batch.length < 1000) break;
    before = batch[batch.length - 1].signature;
  }
  return out.reverse();
}

/** Turn one pool transaction into a trade, or null (creation, migration, failed, unrelated). */
export function parseTrade(tx, coin, vaultB) {
  if (!tx || tx.meta?.err) return null;
  const keys = txKeys(tx);
  const pre = tx.meta.preTokenBalances || [];
  const post = tx.meta.postTokenBalances || [];
  const at = (arr, idx) => arr.find((b) => b.accountIndex === idx);
  const vIdx = keys.indexOf(vaultB);
  if (vIdx < 0) return null;
  const qPost = BigInt(at(post, vIdx)?.uiTokenAmount.amount || 0);
  const qPre = BigInt(at(pre, vIdx)?.uiTokenAmount.amount || 0);
  const quoteDelta = qPost - qPre;
  if (quoteDelta === 0n) return null;
  // The trader: the non-pool owner whose balance of the coin moved the most.
  let trader = null;
  let baseDelta = 0n;
  for (const p of post) {
    if (p.mint !== coin.mint || p.owner === LAUNCHLAB_AUTH) continue;
    const d = BigInt(p.uiTokenAmount.amount) - BigInt(at(pre, p.accountIndex)?.uiTokenAmount.amount || 0);
    if ((d < 0n ? -d : d) > (baseDelta < 0n ? -baseDelta : baseDelta)) {
      baseDelta = d;
      trader = p.owner;
    }
  }
  for (const p of pre) {
    // A sell that closed the trader's token account has no post balance.
    if (p.mint !== coin.mint || p.owner === LAUNCHLAB_AUTH || at(post, p.accountIndex)) continue;
    const d = -BigInt(p.uiTokenAmount.amount);
    if (-d > (baseDelta < 0n ? -baseDelta : baseDelta)) {
      baseDelta = d;
      trader = p.owner;
    }
  }
  if (!trader || baseDelta === 0n) return null;
  const side = quoteDelta > 0n ? "buy" : "sell";
  return {
    sig: tx.transaction.signatures[0],
    slot: tx.slot,
    t: (tx.blockTime || Math.floor(Date.now() / 1000)) * 1000,
    w: trader,
    s: side,
    q: (quoteDelta < 0n ? -quoteDelta : quoteDelta).toString(),
    b: (baseDelta < 0n ? -baseDelta : baseDelta).toString(),
  };
}

/**
 * Index new trades of one coin. `pairUsd` prices trader volume. Returns the new trades.
 * Mutates `state` (createSlot) so the caller can persist it in the market record.
 */
export async function indexCoin(coin, pairUsd, state) {
  const vaultB = getPdaLaunchpadVaultId(LAUNCHPAD_PROGRAM, new PublicKey(coin.poolId), new PublicKey(coin.pair)).publicKey.toBase58();
  const cursor = await kv(["GET", K.cursor(coin.mint)]);
  let sigs = await newSignatures(coin.poolId, cursor);
  if (!sigs.length) return [];
  // A first run on a busy pool: keep the earliest (bundle check) and the latest (volume) only.
  if (!cursor && sigs.length > 2000) sigs = [...sigs.slice(0, 500), ...sigs.slice(-1500)];
  if (!state.createSlot) state.createSlot = cursor ? state.createSlot : sigs[0].slot;

  const rate = CFG.platformRate;
  const vault = platformVaultOf(coin);
  const dec = coin.pairDecimals ?? 9;
  const trades = [];
  for (let i = 0; i < sigs.length; i += 10) {
    const chunk = sigs.slice(i, i + 10).filter((s) => !s.err);
    const txs = await Promise.all(chunk.map((s) => getTx(s.signature).catch(() => null)));
    for (const tx of txs) {
      const tr = parseTrade(tx, coin, vaultB);
      if (tr) trades.push(tr);
    }
  }
  for (const tr of trades) {
    await kv(["LPUSH", K.trades(coin.mint), JSON.stringify(tr)]);
    const fee = Math.floor(Number(tr.q) * rate);
    if (fee > 0) await kv(["HINCRBY", K.feeAttr(vault), coin.mint, fee]);
    const usd = (Number(tr.q) / 10 ** dec) * pairUsd;
    // Volume counts for the week the trade happened in. A creator's trades on their own coin never count.
    if (usd > 0 && tr.w !== coin.launcher) {
      const wk = weekKey(tr.t);
      await kv(["HINCRBYFLOAT", K.traderVol(wk), tr.w, usd.toFixed(4)]);
      const hour = Math.floor(tr.t / 3600_000);
      const n = Number(await kv(["HINCRBY", K.tradeCount(hour), tr.w, 1]));
      if (n === 1) await kv(["EXPIRE", K.tradeCount(hour), 3 * 86400]);
      if (n > CFG.botTradesPerHour) await kv(["HSET", K.bots(wk), tr.w, 1]);
    }
    if (state.createSlot && tr.s === "buy" && tr.slot <= state.createSlot + CFG.bundleSlots) await kv(["LPUSH", K.early(coin.mint), JSON.stringify(tr)]);
    if (usd >= 1) await kv(["LPUSH", K.tape, JSON.stringify({ mint: coin.mint, ticker: coin.ticker, image: coin.image, s: tr.s, usd: Math.round(usd * 100) / 100, t: tr.t, w: tr.w })]);
  }
  if (trades.length) await kv(["LTRIM", K.tape, 0, 199]);
  await kv(["LTRIM", K.trades(coin.mint), 0, 999]);
  await kv(["SET", K.cursor(coin.mint), sigs[sigs.length - 1].signature]);
  return trades;
}

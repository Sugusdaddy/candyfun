// One keeper tick. Runs every minute from a cron (/api/cron/tick) or in a loop from the CLI (run.mjs).
//   1. index new trades of every coin (volume, weekly trader volume, bot filter, the global tape)
//   2. refresh market records (mcap, ATH, 24 h volume/change, sparkline, holders)
//   3. bundle check + safety grade ~90 s after launch, again at 15 min
//   4. claim the 0.1% platform fee vaults into the trader pot, swap non-SOL pots to SOL
//   5. once a week has ended, airdrop the pot to its top traders by volume
import { CFG } from "./lib/config.mjs";
import { K, getJson, kv } from "./lib/kv.mjs";
import { usdPrices } from "./lib/price.mjs";
import { indexCoin } from "./lib/indexer.mjs";
import { readPools, topHolders, updateMarket } from "./lib/market.mjs";
import { holders } from "./lib/holders.mjs";
import { bundleCheck } from "./lib/bundle.mjs";
import { claimToPot } from "./lib/fees.mjs";
import { swapPotToSol, weeklyPayout } from "./lib/payouts.mjs";

async function listCoins() {
  const mints = (await kv(["LRANGE", K.coins, 0, -1])) || [];
  if (!mints.length) return [];
  const raw = await kv(["MGET", ...mints.map(K.coin)]);
  return raw.filter(Boolean).map((s) => JSON.parse(s));
}

/**
 * @param {{ log?: (...a: any[]) => void, deadline?: number, shouldStop?: () => boolean }} opts
 *   deadline: epoch ms after which the tick wraps up early (serverless time limit).
 */
export async function tick(opts = {}) {
  const log = opts.log || ((...a) => console.log(new Date().toISOString().slice(11, 19), ...a));
  const late = () => (opts.deadline && Date.now() > opts.deadline) || (opts.shouldStop && opts.shouldStop());
  const t0 = Date.now();
  const coins = await listCoins();
  if (coins.length) {
    const prices = await usdPrices([...new Set(coins.map((c) => c.pair))]).catch(() => ({}));
    const pools = await readPools(coins);
    const holdersAt = (await getJson(K.keeper + ":holdersAt")) || {};

    for (const coin of coins) {
      if (late()) break;
      try {
        const pairUsd = prices[coin.pair] || 0;
        const prev = (await getJson(K.market(coin.mint))) || {};
        const state = { createSlot: prev.createSlot || 0 };
        const pool = pools[coin.mint];
        if (pool && !pool.stats.graduated) {
          const n = await indexCoin(coin, pairUsd, state);
          if (n.length) log(`${coin.ticker}: ${n.length} new trades`);
        }

        const age = Date.now() - coin.createdAt;
        const bundle = await getJson(K.bundle(coin.mint));
        const needBundle = age >= CFG.bundleAfterSec * 1000 && (!bundle || (bundle.at < coin.createdAt + 15 * 60_000 && age >= 15 * 60_000));
        const needHolders = needBundle || Date.now() - (holdersAt[coin.mint] || 0) > CFG.holdersEveryMin * 60_000;
        const extra = { createSlot: state.createSlot };
        if (needHolders && !late()) {
          const map = await holders(coin.mint).catch((e) => (log(`${coin.ticker}: holders failed ${e.message}`), null));
          if (map) {
            holdersAt[coin.mint] = Date.now();
            const supply = pool?.raw?.supply?.toString() || "1000000000000000";
            extra.holders = map.size;
            extra.topHolders = topHolders(map, supply);
            if (needBundle) {
              const b = await bundleCheck(coin, map, supply, state.createSlot);
              log(`${coin.ticker}: bundle check ${b.grade} (${b.buyers.length} early, ${b.buyers.filter((x) => x.linked).length} linked)`);
            }
          }
        }
        await updateMarket(coin, pool, pairUsd, extra);
      } catch (e) {
        log(`${coin.ticker}: ${String(e.message || e).slice(0, 200)}`);
      }
    }
    await kv(["SET", K.keeper + ":holdersAt", JSON.stringify(holdersAt)]);

    if (!late()) {
      try {
        await claimToPot(coins, prices, log);
      } catch (e) {
        log("claim failed:", String(e.message).slice(0, 200));
      }
    }
    for (const q of [...new Set(coins.map((c) => c.pair))]) {
      if (late()) break;
      const dec = coins.find((c) => c.pair === q)?.pairDecimals ?? 9;
      try {
        await swapPotToSol(q, dec, prices[q] || 0, log);
      } catch (e) {
        log(`pot swap ${q.slice(0, 4)} failed:`, String(e.message).slice(0, 200));
      }
    }
  }

  if (!late()) {
    try {
      await weeklyPayout(log);
    } catch (e) {
      log("airdrop failed:", String(e.message).slice(0, 200));
    }
  }
  const ms = Date.now() - t0;
  await kv(["SET", K.keeper, JSON.stringify({ at: Date.now(), coins: coins.length, ms, dry: CFG.dry })]);
  if (coins.length) log(`tick done: ${coins.length} coins in ${(ms / 1000).toFixed(1)}s`);
  return { coins: coins.length, ms };
}

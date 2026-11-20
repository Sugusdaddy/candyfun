// The weekly trader airdrop.
//
//   1. pots held in a pair token other than SOL are swapped to SOL (Jupiter)
//   2. once a week has ended (Monday 00:00 UTC), its top wallets by volume share the whole SOL pot
//      pro rata; bots are left out
//
// The plan for a week (who gets how much) is written before anything is sent and every batch is
// recorded as it lands, so a keeper that restarts mid-payout continues where it stopped and never
// pays a wallet twice.
import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, AddressLookupTableAccount, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { CFG, SOL_MINT } from "./config.mjs";
import { K, getJson, hashObj, kv, setJson } from "./kv.mjs";
import { conn, feeWallet, getTx, send } from "./solana.mjs";
import { weekKey } from "./indexer.mjs";

const toIx = (i) =>
  new TransactionInstruction({
    programId: new PublicKey(i.programId),
    keys: i.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(i.data, "base64"),
  });

async function jupiter(inputMint, outputMint, amount) {
  const q = await (await fetch(`${CFG.jupiterBase}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=300`)).json();
  if (!q?.outAmount) throw new Error("no Jupiter route " + inputMint.slice(0, 4) + "→" + outputMint.slice(0, 4));
  const j = await (
    await fetch(`${CFG.jupiterBase}/swap-instructions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quoteResponse: q, userPublicKey: feeWallet.publicKey.toBase58(), wrapAndUnwrapSol: true }),
    })
  ).json();
  if (j.error) throw new Error("Jupiter: " + j.error);
  return { q, j };
}

async function sendV0(ixs, lookups) {
  const infos = lookups.length ? await conn.getMultipleAccountsInfo(lookups.map((a) => new PublicKey(a))) : [];
  const luts = infos.map((ai, i) => (ai ? new AddressLookupTableAccount({ key: new PublicKey(lookups[i]), state: AddressLookupTableAccount.deserialize(ai.data) }) : null)).filter(Boolean);
  const bh = await conn.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({ payerKey: feeWallet.publicKey, recentBlockhash: bh.blockhash, instructions: ixs }).compileToV0Message(luts);
  const tx = new VersionedTransaction(msg);
  tx.sign([feeWallet]);
  const sig = bs58.encode(tx.signatures[0]);
  await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  const conf = await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  if (conf.value.err) throw new Error("failed " + JSON.stringify(conf.value.err));
  return sig;
}

async function spendable() {
  const bal = await conn.getBalance(feeWallet.publicKey);
  return BigInt(Math.max(0, bal - Math.round(CFG.minOperatingSol * 1e9)));
}

/** A pot held in a pair token becomes SOL, and joins the SOL pot at what the swap guaranteed. */
export async function swapPotToSol(quote, dec, price, log) {
  if (quote === SOL_MINT) return;
  const amt = BigInt(hashObj(await kv(["HGETALL", K.quoteLedger(quote)])).pot || "0");
  if (amt <= 0n || (Number(amt) / 10 ** dec) * price < CFG.minSwapUsd) return;
  log(`pot: swap ${Number(amt) / 10 ** dec} ${quote.slice(0, 4)} → SOL`);
  if (CFG.dry || !feeWallet) return;
  const { q, j } = await jupiter(quote, SOL_MINT, amt);
  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }), ...(j.setupInstructions || []).map(toIx), toIx(j.swapInstruction)];
  if (j.cleanupInstruction) ixs.push(toIx(j.cleanupInstruction));
  const sig = await sendV0(ixs, j.addressLookupTableAddresses || []);
  await kv(["HINCRBY", K.quoteLedger(quote), "pot", (-amt).toString()]);
  await kv(["HINCRBY", K.quoteLedger(SOL_MINT), "pot", q.otherAmountThreshold]);
  log(`  ${sig}`);
}

/** Who shares the pot for a finished week: top N by volume, bots out, pro rata. */
export function planWeek({ week, volumes, bots, potLamports, topN, minPayoutLamports }) {
  const ranked = Object.entries(volumes)
    .map(([w, usd]) => ({ w, usd: Number(usd) }))
    .filter((r) => r.usd > 0 && !bots.has(r.w))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, topN);
  const total = ranked.reduce((a, r) => a + r.usd, 0);
  const rows = [];
  if (total > 0) {
    // Integer maths on micro-dollars so the shares never add up to more than the pot.
    const micro = ranked.map((r) => BigInt(Math.round(r.usd * 1e6)));
    const sum = micro.reduce((a, x) => a + x, 0n);
    ranked.forEach((r, i) => {
      const lamports = (potLamports * micro[i]) / sum;
      if (lamports >= minPayoutLamports) rows.push({ w: r.w, usd: r.usd, lamports: lamports.toString(), sig: null });
    });
  }
  const paying = rows.reduce((a, r) => a + BigInt(r.lamports), 0n);
  return { week, createdAt: Date.now(), potLamports: potLamports.toString(), payingLamports: paying.toString(), totalUsd: total, traders: ranked.length, rows, status: rows.length ? "paying" : "skipped" };
}

/** Did a transfer batch we are not sure about actually land? */
async function landed(sig) {
  if (!sig) return false;
  const tx = await getTx(sig).catch(() => null);
  return !!tx && !tx.meta?.err;
}

export async function weeklyPayout(log, now = Date.now()) {
  const week = weekKey(now - 7 * 86400_000); // the week that just ended
  let plan = await getJson(K.payout(week));
  if (!plan) {
    const volumes = hashObj(await kv(["HGETALL", K.traderVol(week)]));
    const bots = new Set(Object.keys(hashObj(await kv(["HGETALL", K.bots(week)]))));
    const pot = BigInt(hashObj(await kv(["HGETALL", K.quoteLedger(SOL_MINT)])).pot || "0");
    if (!Object.keys(volumes).length) return; // nobody traded: nothing to do, the pot stays
    if (pot < BigInt(Math.round(CFG.minPotSol * 1e9))) return; // too small this week: rolls over
    plan = planWeek({ week, volumes, bots, potLamports: pot, topN: CFG.topN, minPayoutLamports: BigInt(Math.round(CFG.minPayoutSol * 1e9)) });
    log(`airdrop ${week}: pot ${Number(pot) / 1e9} SOL → ${plan.rows.length} of ${plan.traders} ranked wallets (${bots.size} bots left out)`);
    if (CFG.dry) return;
    await setJson(K.payout(week), plan);
    // What is being paid leaves the pot now; shares under the minimum stay in it for next week.
    await kv(["HINCRBY", K.quoteLedger(SOL_MINT), "pot", (-BigInt(plan.payingLamports)).toString()]);
  }
  if (plan.status !== "paying" || CFG.dry || !feeWallet) return;

  const BATCH = 18;
  for (let i = 0; i < plan.rows.length; i += BATCH) {
    const part = plan.rows.slice(i, i + BATCH).filter((r) => !r.sig);
    if (!part.length) continue;
    // A batch that was sent but never recorded (crash, timeout): check the chain before resending.
    const key = `b${i}`;
    plan.sent = plan.sent || {};
    if (plan.sent[key]) {
      if (await landed(plan.sent[key])) {
        for (const r of part) r.sig = plan.sent[key];
        await setJson(K.payout(week), plan);
        continue;
      }
      if (Date.now() - (plan.sentAt?.[key] || 0) < 180_000) return; // may still land: wait
    }
    const sum = part.reduce((a, r) => a + BigInt(r.lamports), 0n);
    if ((await spendable()) < sum) return log("  airdrop waits: fee wallet below what it owes");
    const ixs = part.map((r) => SystemProgram.transfer({ fromPubkey: feeWallet.publicKey, toPubkey: new PublicKey(r.w), lamports: Number(r.lamports) }));
    try {
      const sig = await send(ixs, [feeWallet], {
        cu: 2_000 * part.length + 5_000,
        attempts: 1, // never resend blindly: the next tick checks the recorded signature first
        onSigned: async (s) => {
          plan.sent[key] = s;
          plan.sentAt = { ...(plan.sentAt || {}), [key]: Date.now() };
          await setJson(K.payout(week), plan);
        },
      });
      for (const r of part) r.sig = sig;
      await setJson(K.payout(week), plan);
      log(`  paid ${part.length} traders · ${sig}`);
    } catch (e) {
      return log(`  airdrop batch failed: ${String(e.message).slice(0, 160)}`);
    }
  }
  if (plan.rows.every((r) => r.sig)) {
    plan.status = "done";
    plan.doneAt = Date.now();
    await setJson(K.payout(week), plan);
    const sol = Number(plan.payingLamports) / 1e9;
    await kv(["HINCRBYFLOAT", K.stats, "paidSol", sol.toFixed(9)]);
    await kv(["HINCRBY", K.stats, "payouts", 1]);
    await kv(["LPUSH", K.payouts, JSON.stringify({ week, at: plan.doneAt, sol, wallets: plan.rows.length, totalUsd: plan.totalUsd, top: plan.rows.slice(0, 3).map((r) => ({ w: r.w, sol: Number(r.lamports) / 1e9 })), sig: plan.rows[0].sig })]);
    await kv(["LTRIM", K.payouts, 0, 103]);
    await kv(["LPUSH", K.feed, JSON.stringify({ t: "airdrop", week, n: plan.rows.length, sol, at: plan.doneAt, sig: plan.rows[0].sig })]);
    log(`airdrop ${week} done: ${sol} SOL to ${plan.rows.length} wallets`);
  }
}

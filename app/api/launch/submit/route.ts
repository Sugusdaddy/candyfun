// Step 2 of a launch: the fully signed transaction comes back, we relay it and list the coin once
// its pool exists on-chain under Candyfun's platform with the launcher as creator.
//
// The server relays the transaction only if it still does what step 1 built (see checkLaunchTx).
import { NextRequest, NextResponse } from "next/server";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { FEE_WALLET, LAUNCHPAD_PROGRAM, PLATFORM_ID, SOL_MINT } from "@/lib/config";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
import { K, kv } from "@/lib/kv";
import { viewPool } from "@/lib/launchlab";
import { rpc } from "@/lib/solana";
import { addCoin, getLaunch, putLaunch, type Coin, type PendingLaunch } from "@/lib/store";
import { confirmLocks, recordAndFlag, release } from "@/lib/vamp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Wallets are allowed to touch a transaction before signing it (Phantom adds its own guard and
 * priority-fee instructions), so the signed message is not byte-identical to the one we built.
 * What must hold: the launcher pays, it creates this launch's pool under our platform, and a copy
 * still carries its anti-vamp fee to the fee wallet. Everything else is checked on-chain afterwards.
 */
function checkLaunchTx(tx: VersionedTransaction, launch: PendingLaunch): string | null {
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  if (keys[0] !== launch.payer) return "The launch must be signed and paid by the launching wallet";
  const has = (k: string) => keys.includes(k);
  if (!has(LAUNCHPAD_PROGRAM) || !has(PLATFORM_ID) || !has(launch.poolId) || !has(launch.mint)) return "This is not the launch transaction we built";
  const creates = tx.message.compiledInstructions.some((ix) => {
    if (keys[ix.programIdIndex] !== LAUNCHPAD_PROGRAM) return false;
    const accts = ix.accountKeyIndexes.map((i) => keys[i]);
    return accts.includes(PLATFORM_ID) && accts.includes(launch.poolId) && accts.includes(launch.mint);
  });
  if (!creates) return "This is not the launch transaction we built";
  if (launch.vampFeeLamports > 0) {
    const paid = tx.message.compiledInstructions.some((ix) => {
      if (keys[ix.programIdIndex] !== SYSTEM_PROGRAM || ix.data.length !== 12) return false;
      const data = Buffer.from(ix.data);
      if (data.readUInt32LE(0) !== 2) return false; // SystemProgram.transfer
      const [from, to] = ix.accountKeyIndexes.map((i) => keys[i]);
      return from === launch.payer && to === FEE_WALLET && data.readBigUInt64LE(4) >= BigInt(launch.vampFeeLamports);
    });
    if (!paid) return "The anti-vamp fee is missing from this launch";
  }
  return null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return bad("Invalid request");
  }
  const launch = await getLaunch(String(b.launchId || ""));
  if (!launch) return bad("Launch not found or expired", 404);
  if (launch.status === "live") return NextResponse.json({ status: "live", mint: launch.mint, sig: launch.createSig });
  if (launch.status !== "pending") return bad("This launch was cancelled, start again", 409);

  const conn = rpc();
  let sig = String(b.signature || "");
  if (b.signedTx) {
    let tx: VersionedTransaction;
    try {
      tx = VersionedTransaction.deserialize(Buffer.from(String(b.signedTx), "base64"));
    } catch {
      return bad("Invalid transaction");
    }
    const why = checkLaunchTx(tx, launch);
    if (why) return bad(why);
    try {
      sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
    } catch (e: any) {
      // Already landed on a retry? Fall through to the pool check.
      const msg = String(e?.message || e);
      if (!/already been processed|already in use/i.test(msg)) {
        await release(launch.id, launch);
        launch.status = "failed";
        launch.error = msg.slice(0, 300);
        await putLaunch(launch);
        const logs = (e?.logs || []).filter((l: string) => /Error|failed|insufficient/i.test(l)).slice(-2).join(" | ");
        return bad("Launch failed: " + (logs || msg).slice(0, 220));
      }
    }
  }

  // The chain is the source of truth: wait for the pool.
  let pool = null;
  for (let i = 0; i < 40 && !pool; i++) {
    const ai = await conn.getAccountInfo(new PublicKey(launch.poolId), "confirmed").catch(() => null);
    if (ai) pool = viewPool(launch.poolId, ai.data);
    else await sleep(1500);
  }
  if (!pool) {
    await release(launch.id, launch);
    return bad("The launch did not confirm. Nothing was created; try again.", 504);
  }
  if (pool.platformId !== PLATFORM_ID || pool.creator !== launch.payer) return bad("That pool was not created through Candyfun", 409);

  // One listing per launch, even if submit is called twice.
  if ((await kv(["SET", K.launch(launch.id) + ":listed", "1", "NX", "EX", 86400])) !== "OK") {
    return NextResponse.json({ status: "live", mint: launch.mint, sig: launch.createSig || sig });
  }
  if (!sig) {
    const sigs = await conn.getSignaturesForAddress(new PublicKey(launch.poolId), { limit: 5 }, "confirmed").catch(() => []);
    sig = sigs.length ? sigs[sigs.length - 1].signature : "unknown";
  }

  const flags = await recordAndFlag(launch.mint, launch.ticker, launch.imageSha);
  await confirmLocks(launch.id, launch.mint, launch);
  // The vamp fee landed in the fee wallet inside the launch transaction: it joins the trader pot.
  if (launch.vampFeeLamports > 0) {
    await kv(["HINCRBY", K.quoteLedger(SOL_MINT), "pot", launch.vampFeeLamports]);
    await kv(["HINCRBYFLOAT", K.stats, "vampFeesSol", (launch.vampFeeLamports / 1e9).toFixed(9)]);
  }
  const coin: Coin = {
    mint: launch.mint,
    name: launch.name,
    ticker: launch.ticker,
    description: launch.description,
    image: launch.image,
    metadataUri: launch.metadataUri,
    website: launch.website,
    twitter: launch.twitter,
    telegram: launch.telegram,
    tweetUrl: launch.tweetUrl,
    pair: launch.pair,
    pairSymbol: launch.pairSymbol,
    pairDecimals: launch.pairDecimals,
    platformId: PLATFORM_ID,
    poolId: launch.poolId,
    launcher: launch.payer,
    launchId: launch.id,
    createSig: sig,
    devBuyRaw: launch.devBuyRaw,
    vampFeeSol: launch.vampFeeLamports / 1e9,
    vampOf: launch.vampOf,
    createdAt: Date.now(),
    curve: launch.curve,
    flags,
  };
  await addCoin(coin);
  launch.status = "live";
  launch.createSig = sig;
  await putLaunch(launch);
  return NextResponse.json({ status: "live", mint: launch.mint, sig });
}

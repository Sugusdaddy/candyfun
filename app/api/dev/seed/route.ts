// Local runs only (KV_MEMORY=1): register a few real LaunchLab pools as Candyfun coins so the feed and
// coin pages can be checked against live chain data without launching anything.
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getPdaLaunchpadPoolId } from "@raydium-io/raydium-sdk-v2";
import { PROGRAM, viewPool } from "@/lib/launchlab";
import { rpc } from "@/lib/solana";
import { addCoin, getCoin, type Coin } from "@/lib/store";
import { recordAndFlag } from "@/lib/vamp";
import { K, kv } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLES = [
  { mint: "71c73V9RR77YjobUjTL8rahind3zRfENrAkLyUWgNYXz", pair: "APLPiTjBWzwfZ5U1TBeqLF9XJ7dV7XKGe7j4BZhkDray", pairSymbol: "PEAK", pairDecimals: 6, name: "The Don", ticker: "DON" },
  { mint: "6e7HJV6rRUtbfsA7oeRDgLP55n7PjeyrcJ9UGzQZhigh", pair: "So11111111111111111111111111111111111111112", pairSymbol: "SOL", pairDecimals: 9, name: "Higher sample", ticker: "HSAMPLE" },
  { mint: "BTyRbNsTc9MMdPfpFM6bdtiJL3EY3M1iATceKcqmuxc1", pair: "So11111111111111111111111111111111111111112", pairSymbol: "SOL", pairDecimals: 9, name: "Zero sample", ticker: "ZSAMPLE" },
  { mint: "CRdQQLTNnii9AWGP3ifSZ5DUHscTWosaGeXrvXdFhigh", pair: "So11111111111111111111111111111111111111112", pairSymbol: "SOL", pairDecimals: 9, name: "Lookalike test", ticker: "D0N" },
] as const;

export async function POST() {
  if (process.env.KV_MEMORY !== "1") return NextResponse.json({ error: "local only" }, { status: 403 });
  const conn = rpc();
  const out: string[] = [];
  for (const s of SAMPLES) {
    if (await getCoin(s.mint)) continue;
    const poolId = getPdaLaunchpadPoolId(PROGRAM, new PublicKey(s.mint), new PublicKey(s.pair)).publicKey;
    const ai = await conn.getAccountInfo(poolId);
    if (!ai) continue;
    const v = viewPool(poolId.toBase58(), ai.data);
    const asset = await fetch(process.env.RPC_URL!, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAsset", params: { id: s.mint } }) })
      .then((r) => r.json())
      .catch(() => null);
    const image = asset?.result?.content?.links?.image || "";
    const createdAt = Date.now() - Math.floor(Math.random() * 6 * 3600_000);
    const flags = await recordAndFlag(s.mint, s.ticker, s.mint);
    const coin: Coin = {
      mint: s.mint,
      name: s.name,
      ticker: s.ticker,
      description: "Sample coin for local testing (a real LaunchLab pool shown as a Candyfun coin).",
      image,
      metadataUri: "",
      pair: s.pair,
      pairSymbol: s.pairSymbol,
      pairDecimals: s.pairDecimals,
      platformId: v.platformId,
      poolId: poolId.toBase58(),
      launcher: v.creator,
      launchId: "seed",
      createSig: "seed",
      devBuyRaw: "0",
      createdAt,
      curve: { startMcapUsd: 20000, gradMcapUsd: 150000, raiseQuote: v.targetQuote, totalFundRaisingB: v.totalFundRaisingB, totalSellA: v.totalSellA, locked: v.lockedRaw },
      flags,
    };
    await addCoin(coin);
    await kv(["SET", K.lock("ticker", s.ticker), JSON.stringify({ launchId: "seed", mint: s.mint, at: createdAt, until: createdAt, ticker: s.ticker })]);
    out.push(s.ticker);
  }
  return NextResponse.json({ seeded: out });
}

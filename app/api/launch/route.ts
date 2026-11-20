// Step 1 of a launch: validate the coin, size its curve, quote the anti-vamp fee, upload the
// metadata and hand back the unsigned launch transaction. The creator's wallet and the mint keypair
// (generated in the creator's browser) sign it; the server holds no key that can.
//
//   POST   → { launchId, tx, mint, vampFeeSol, … }
//   DELETE ?id=<launchId>  → cancel a launch that was never sent (frees its reservation)
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { FEE_WALLET, GRAD_MULTIPLE, MAX_DEV_BUY_PCT, NETWORK_COST_SOL, PLATFORM_ID, SITE_URL, SOL_MINT, START_MCAP_USD } from "@/lib/config";
import { K, allow, clientIp, kv } from "@/lib/kv";
import { buildLaunchTx } from "@/lib/launch";
import { SUPPLY_RAW, checkCurve, readGlobalConfig, readMint, sizeCurve } from "@/lib/launchlab";
import { PAIR_BY_MINT } from "@/lib/pairs";
import { usdPrice } from "@/lib/price";
import { isPubkey, rpc } from "@/lib/solana";
import { normSocials } from "@/lib/socials";
import { getLaunch, putLaunch, type PendingLaunch } from "@/lib/store";
import { describeQuote, imageHash, normTicker, release, reserve, tweetId } from "@/lib/vamp";
import { FAKE_UPLOADS, parseDataUri, uploadTokenMetadata } from "@/lib/irys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Launch attempts per hour (each one uploads metadata). Raise LAUNCH_LIMIT for local testing.
const LIMIT = Number(process.env.LAUNCH_LIMIT || 6);
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req: NextRequest) {
  if (!(await allow("launch", clientIp(req), LIMIT * 2, 3600))) return bad("Too many launch attempts, slow down", 429);
  let b: any;
  try {
    b = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const payer = String(b.payer || "");
  const mint = String(b.mint || "");
  const name = String(b.name || "").trim();
  const ticker = normTicker(String(b.ticker || ""));
  const description = String(b.description || "").trim();
  const pair = String(b.pair || "");
  const tweetUrl = b.tweetUrl ? String(b.tweetUrl).trim() : null;

  if (!PLATFORM_ID) return bad("Launches open very soon: the Candyfun platform is being set up on-chain", 503);
  if (!isPubkey(payer)) return bad("Connect a wallet first");
  if (!isPubkey(mint)) return bad("Missing mint");
  if (name.length < 1 || name.length > 32) return bad("Name must be 1-32 characters");
  if (!/^[A-Z0-9]{2,10}$/.test(ticker)) return bad("Ticker must be 2-10 letters or numbers");
  if (description.length > 500) return bad("Description is too long (500 max)");
  if (!isPubkey(pair)) return bad("Pick a pair");
  if (tweetUrl && !tweetId(tweetUrl)) return bad("Launch tweet must be an x.com/…/status/… link");
  const { socials, error: socialErr } = normSocials({ website: b.website, twitter: b.twitter, telegram: b.telegram });
  if (socialErr) return bad(socialErr);
  if (typeof b.image !== "string" || !b.image.startsWith("data:image/")) return bad("Add an image");
  const img = parseDataUri(b.image);
  if (img.buf.length > 1_500_000) return bad("Image must be under 1.5 MB");
  if (!(await allow("launchw", payer, LIMIT, 3600))) return bad("Too many launch attempts from this wallet, slow down", 429);

  let devBuy = 0n;
  try {
    devBuy = BigInt(String(b.devBuyRaw || "0"));
  } catch {
    return bad("Invalid first buy");
  }
  if (devBuy < 0n) return bad("Invalid first buy");

  // The pair must be enabled on LaunchLab and priced, and the curve must fit its limits.
  const conn = rpc();
  const [platformAi, mintAi, cfg] = await Promise.all([
    conn.getAccountInfo(new PublicKey(PLATFORM_ID)).catch(() => null),
    conn.getAccountInfo(new PublicKey(mint)).catch(() => null),
    readGlobalConfig(conn, pair),
  ]);
  if (!platformAi) return bad("Launches open very soon: the Candyfun platform is being set up on-chain", 503);
  if (mintAi) return bad("That mint already exists, try again");
  if (!cfg) return bad("Raydium hasn't enabled launches against this token yet");
  let curve;
  let pairDecimals = 9;
  let quoteProgram: PublicKey;
  try {
    const m = await readMint(conn, pair);
    pairDecimals = m.decimals;
    quoteProgram = m.program;
    const price = await usdPrice(pair);
    curve = sizeCurve({ startMcapUsd: START_MCAP_USD, multiple: GRAD_MULTIPLE, quotePriceUsd: price, quoteDecimals: m.decimals });
    checkCurve(curve, cfg);
  } catch (e: any) {
    return bad(e.message || "This pair can't be used right now");
  }

  // Anti-vamp: the first use is free, a copy is quoted a fee by the age of what it copies.
  const id = crypto.randomBytes(9).toString("base64url");
  let vamp;
  try {
    vamp = await reserve(id, { ticker, name, tweetUrl });
  } catch (e: any) {
    return bad(e.message, 409);
  }
  // The form shows the fee before launching; if it changed since (someone launched first), ask again.
  const accepted = Number(b.acceptVampFeeSol || 0);
  if (vamp.sol > accepted) {
    await release(id, { ticker, name, tweetUrl });
    return bad(describeQuote(vamp), 409, { vampFeeSol: vamp.sol });
  }
  const vampFeeLamports = Math.round(vamp.sol * 1e9);

  try {
    // Enough SOL for rent, network, the vamp fee and (for SOL pairs) the first buy.
    const need = Math.round(NETWORK_COST_SOL * 1e9) + vampFeeLamports + (pair === SOL_MINT ? Number(devBuy) : 0);
    const bal = await conn.getBalance(new PublicKey(payer));
    if (bal < need) throw new Error(`Your wallet needs about ${(need / 1e9).toFixed(3)} SOL for this launch`);

    const meta = FAKE_UPLOADS
      ? { imageUri: b.image as string, metadataUri: `${SITE_URL}/api/meta/${mint}` }
      : await uploadTokenMetadata({
          name,
          symbol: ticker,
          description,
          logoDataUri: b.image,
          website: socials.website || `${SITE_URL}/coin/${mint}`,
          twitter: socials.twitter,
          telegram: socials.telegram,
        });

    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    const { tx, poolId, devBuyOut } = buildLaunchTx({
      creator: new PublicKey(payer),
      mint: new PublicKey(mint),
      quote: pair,
      quoteProgram,
      platformId: PLATFORM_ID,
      curve,
      name,
      symbol: ticker,
      uri: meta.metadataUri,
      blockhash,
      devBuyQuoteRaw: devBuy,
      vampFeeLamports,
      feeWallet: FEE_WALLET,
    });
    if (devBuyOut * 100n > SUPPLY_RAW * BigInt(MAX_DEV_BUY_PCT)) throw new Error(`The first buy can take at most ${MAX_DEV_BUY_PCT}% of the supply`);
    const raw = tx.serialize();
    if (raw.length > 1232) throw new Error("Launch transaction is too large: shorten the name or drop the first buy");

    const launch: PendingLaunch = {
      id,
      status: "pending",
      payer,
      mint,
      poolId: poolId.toBase58(),
      name,
      ticker,
      description,
      ...socials,
      tweetUrl,
      pair,
      pairSymbol: PAIR_BY_MINT[pair]?.symbol || String(b.pairSymbol || "").slice(0, 12) || "?",
      pairDecimals,
      image: meta.imageUri,
      metadataUri: meta.metadataUri,
      imageSha: imageHash(img.buf),
      devBuyRaw: devBuyOut.toString(),
      vampFeeLamports,
      vampOf: vamp.mint || null,
      // The server only ever relays exactly the message it built.
      messageSha: crypto.createHash("sha256").update(tx.message.serialize()).digest("hex"),
      curve: {
        startMcapUsd: curve.startMcapUsd,
        gradMcapUsd: curve.gradMcapUsd,
        raiseQuote: curve.raiseQuote,
        totalFundRaisingB: curve.totalFundRaisingB.toString(),
        totalSellA: curve.totalSellA.toString(),
        locked: "0",
      },
      createdAt: Date.now(),
    };
    await putLaunch(launch);
    // Local runs keep the inline image so /api/meta can serve it.
    if (FAKE_UPLOADS) await kv(["SET", K.launchImage(id), JSON.stringify({ image: b.image }), "EX", 3600]);

    return NextResponse.json({
      launchId: id,
      mint,
      tx: Buffer.from(raw).toString("base64"),
      vampFeeSol: vamp.sol,
      devBuyOut: devBuyOut.toString(),
      curve: { startMcapUsd: Math.round(curve.startMcapUsd), gradMcapUsd: curve.gradMcapUsd, raiseQuote: curve.raiseQuote, pairDecimals },
    });
  } catch (e: any) {
    await release(id, { ticker, name, tweetUrl });
    return bad(String(e?.message || e).slice(0, 240));
  }
}

export async function DELETE(req: NextRequest) {
  const launch = await getLaunch(req.nextUrl.searchParams.get("id") || "");
  if (!launch || launch.status !== "pending") return NextResponse.json({ ok: true });
  // Only when the pool really is not there: a sent transaction may still land.
  if (await rpc().getAccountInfo(new PublicKey(launch.poolId)).catch(() => true)) return NextResponse.json({ ok: false });
  await release(launch.id, launch);
  launch.status = "failed";
  launch.error = "cancelled";
  await putLaunch(launch);
  return NextResponse.json({ ok: true });
}

// Pairs for the launch form, with USD prices and what the curve raises in each.
//   GET /api/pairs              → curated list
//   GET /api/pairs?mint=<mint>  → check a custom pair (enabled on LaunchLab? priced?)
import { NextRequest, NextResponse } from "next/server";
import { GRAD_MULTIPLE, START_MCAP_USD } from "@/lib/config";
import { LaunchpadConfig } from "@raydium-io/raydium-sdk-v2";
import { PROGRAM, checkCurve, readGlobalConfig, readMint, sizeCurve } from "@/lib/launchlab";
import { PAIRS } from "@/lib/pairs";
import { usdPrices } from "@/lib/price";
import { tokenInfo } from "@/lib/tokens";
import { isPubkey, rpc } from "@/lib/solana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assetInfo(mint: string): Promise<{ symbol: string; name: string; image?: string } | null> {
  const url = process.env.RPC_URL;
  if (!url) return null;
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAsset", params: { id: mint } }) });
    const j = await r.json();
    const md = j?.result?.content?.metadata;
    return md ? { symbol: md.symbol || "?", name: md.name || "", image: j?.result?.content?.links?.image } : null;
  } catch {
    return null;
  }
}

/** How many quote tokens Raydium has enabled for LaunchLab right now (cached for an hour). */
const g = globalThis as any;
async function enabledCount(): Promise<number> {
  const c = g.__candyEnabled as { n: number; at: number } | undefined;
  if (c && Date.now() - c.at < 3600_000) return c.n;
  try {
    const accts = await rpc().getProgramAccounts(PROGRAM, { filters: [{ dataSize: LaunchpadConfig.span }], dataSlice: { offset: 0, length: 0 } });
    g.__candyEnabled = { n: accts.length, at: Date.now() };
    return accts.length;
  } catch {
    return c?.n || 0;
  }
}

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint");
  if (mint) {
    if (!isPubkey(mint)) return NextResponse.json({ ok: false, error: "Not a valid mint address" });
    const conn = rpc();
    const cfg = await readGlobalConfig(conn, mint);
    if (!cfg) return NextResponse.json({ ok: false, error: "Raydium hasn't enabled launches against this token yet" });
    const [info, prices, m] = await Promise.all([assetInfo(mint), usdPrices([mint]), readMint(conn, mint).catch(() => null)]);
    if (!m) return NextResponse.json({ ok: false, error: "Token not found" });
    const price = prices[mint] || 0;
    if (!price) return NextResponse.json({ ok: false, error: "No USD price for this token yet" });
    try {
      const c = sizeCurve({ startMcapUsd: START_MCAP_USD, multiple: GRAD_MULTIPLE, quotePriceUsd: price, quoteDecimals: m.decimals });
      checkCurve(c, cfg);
      return NextResponse.json({ ok: true, pair: { mint, symbol: info?.symbol || "?", name: info?.name || "", decimals: m.decimals, priceUsd: price, raise: c.raiseQuote } });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }
  const [prices, info, enabled] = await Promise.all([usdPrices(PAIRS.map((p) => p.mint)), tokenInfo(PAIRS.map((p) => p.mint)), enabledCount()]);
  return NextResponse.json(
    {
      enabled,
      startMcapUsd: START_MCAP_USD,
      gradMcapUsd: START_MCAP_USD * GRAD_MULTIPLE,
      pairs: PAIRS.map((p) => {
        const price = prices[p.mint] || 0;
        let raise = 0;
        try {
          raise = price ? sizeCurve({ startMcapUsd: START_MCAP_USD, multiple: GRAD_MULTIPLE, quotePriceUsd: price, quoteDecimals: p.decimals }).raiseQuote : 0;
        } catch {}
        return { ...p, priceUsd: price, raise, icon: info[p.mint]?.icon || "" };
      }),
    },
    { headers: { "cache-control": "public, max-age=30" } }
  );
}

// Live anti-vamp quote for the launch form: is this ticker / name / tweet unused, or what does a copy cost?
import { NextRequest, NextResponse } from "next/server";
import { describeQuote, foldTicker, normTicker, vampQuote } from "@/lib/vamp";
import { K, kv } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const ticker = normTicker(q.get("ticker") || "");
  const name = q.get("name") || "";
  const tweetUrl = q.get("tweet") || null;
  if (!ticker && !name && !tweetUrl) return NextResponse.json({ ok: true, feeSol: 0 });
  const quote = await vampQuote({ ticker, name, tweetUrl });
  let lookalikes: string[] = [];
  if (ticker) {
    const raw = await kv(["HGET", K.fold, foldTicker(ticker)]);
    lookalikes = raw ? (JSON.parse(raw) as { ticker: string }[]).map((p) => p.ticker).filter((t) => t !== ticker) : [];
  }
  return NextResponse.json({
    ok: true,
    feeSol: quote.sol,
    reason: quote.sol ? describeQuote(quote) : null,
    copies: quote.mint ?? null,
    lookalikes: [...new Set(lookalikes)].slice(0, 5),
  });
}

// Metaplex-style metadata served by us (used only for local runs with FAKE_UPLOADS=1).
import { NextRequest, NextResponse } from "next/server";
import { getCoin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { mint: string } }) {
  const c = await getCoin(params.mint);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ name: c.name, symbol: c.ticker, description: c.description, image: c.image, website: c.website, twitter: c.twitter, telegram: c.telegram });
}

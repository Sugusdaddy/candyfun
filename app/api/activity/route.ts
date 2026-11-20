// Live activity for the top strip: recent trades across coins plus launches, graduations and airdrops.
import { NextResponse } from "next/server";
import { K, kv } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [tape, feed] = await Promise.all([kv(["LRANGE", K.tape, 0, 39]), kv(["LRANGE", K.feed, 0, 29])]);
  const parse = (a: string[] | null) => (a || []).map((s) => JSON.parse(s));
  return NextResponse.json({ trades: parse(tape), events: parse(feed) }, { headers: { "cache-control": "public, max-age=8" } });
}

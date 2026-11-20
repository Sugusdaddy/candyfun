// Vercel Cron, every minute: one keeper tick (see keeper/tick.mjs). A Redis lock keeps ticks from
// overlapping; the tick wraps up early before the function's time limit.
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lockKey = (process.env.KV_PREFIX || "candy:") + "ticklock";
  if ((await kv(["SET", lockKey, String(Date.now()), "NX", "EX", 290])) !== "OK") return NextResponse.json({ skipped: "previous tick still running" });
  const lines: string[] = [];
  try {
    // @ts-ignore — plain ESM module shared with the CLI keeper
    const { tick } = await import("@/keeper/tick.mjs");
    const res = await tick({ log: (...a: any[]) => lines.push(a.join(" ")), deadline: Date.now() + 240_000 });
    return NextResponse.json({ ok: true, ...res, log: lines.slice(-40) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e), log: lines.slice(-40) }, { status: 500 });
  } finally {
    await kv(["DEL", lockKey]);
  }
}

// Local runs only (KV_MEMORY=1): lets the keeper use the web's in-memory store (KV_HTTP).
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.KV_MEMORY !== "1") return NextResponse.json({ error: "local only" }, { status: 403 });
  const host = req.headers.get("host") || "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return NextResponse.json({ error: "local only" }, { status: 403 });
  try {
    const cmd = await req.json();
    return NextResponse.json({ result: await kv(cmd) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) });
  }
}

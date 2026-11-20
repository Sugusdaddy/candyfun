import { ImageResponse } from "next/og";
import { getCoin } from "@/lib/store";
import { liveFor } from "@/lib/markets";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);

export default async function CoinOG({ params }: { params: { mint: string } }) {
  const coin = await getCoin(params.mint).catch(() => null);
  const live = coin ? (await liveFor([coin]).catch(() => ({} as any)))[coin.mint] : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#1b1d28", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, fontFamily: "sans-serif", color: "#f4f4f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: "#ff6fb5", display: "flex" }} />
          <span style={{ fontSize: 44, fontWeight: 800 }}>candyfun</span>
          <span style={{ fontSize: 22, color: "#a1a5b4", marginLeft: 12 }}>0.35% per trade, 0% kept</span>
        </div>
        {coin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coin.image} width={220} height={220} style={{ borderRadius: 32, objectFit: "cover", border: "2px solid #3a3d4c" }} alt="" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: -3, lineHeight: 1 }}>${coin.ticker}</span>
              <span style={{ fontSize: 34, color: "#a1a5b4" }}>{coin.name}</span>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <span style={{ fontSize: 24, padding: "8px 16px", borderRadius: 10, background: "#86efac", color: "#10131a" }}>paired with {coin.pairSymbol}</span>
              </div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 80, fontWeight: 900 }}>Coin on candyfun</span>
        )}
        <div style={{ display: "flex", gap: 40, fontSize: 30 }}>
          <span style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "#a1a5b4" }}>Market cap</span>
            <b>{live ? money(live.mcapUsd) : "—"}</b>
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "#a1a5b4" }}>Graduation</span>
            <b style={{ color: "#86efac" }}>{live ? (live.graduated ? "done" : `${(live.progress * 100).toFixed(1)}%`) : "—"}</b>
          </span>
        </div>
      </div>
    ),
    size
  );
}

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Candyfun: the launchpad that keeps nothing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#1b1d28", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "sans-serif", color: "#f4f4f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: "#ff6fb5", display: "flex" }} />
          <span style={{ fontSize: 56, fontWeight: 800 }}>candyfun</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 80, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>[start a new coin]</span>
          <span style={{ fontSize: 32, color: "#86efac" }}>0.35% per trade. 0% kept. The 0.1% is airdropped to traders every week.</span>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Any Raydium LaunchLab pair", "Starts at $20K", "No launch fee", "Anti-vamp fee", "Open source"].map((t) => (
            <span key={t} style={{ fontSize: 24, padding: "10px 18px", borderRadius: 6, background: "#2a2c38" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    size
  );
}

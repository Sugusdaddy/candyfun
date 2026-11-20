"use client";

import { useEffect, useRef, useState } from "react";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
const TFS = [
  { s: 60, l: "1m" },
  { s: 300, l: "5m" },
  { s: 900, l: "15m" },
  { s: 3600, l: "1h" },
];

/** Market-cap candles from Candyfun's own trade index (TradingView lightweight-charts). */
export function PriceChart({ mint, liveMcap }: { mint: string; liveMcap: number }) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volRef = useRef<any>(null);
  const [tf, setTf] = useState(300);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const { createChart, CrosshairMode } = await import("lightweight-charts");
      if (disposed || !box.current) return;
      const chart = createChart(box.current, {
        autoSize: true,
        layout: { background: { color: "transparent" }, textColor: "#a1a5b4", fontFamily: "var(--font-mono), monospace", fontSize: 11 },
        grid: { vertLines: { color: "#ece8df" }, horzLines: { color: "#ece8df" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#3a3d4c" },
        timeScale: { borderColor: "#3a3d4c", timeVisible: true, secondsVisible: false },
        localization: {
          priceFormatter: (p: number) => (p >= 1e6 ? `$${(p / 1e6).toFixed(2)}M` : p >= 1e3 ? `$${(p / 1e3).toFixed(1)}K` : `$${p.toFixed(0)}`),
        },
      });
      seriesRef.current = chart.addCandlestickSeries({ upColor: "#4ade80", downColor: "#f87171", borderVisible: false, wickUpColor: "#4ade80", wickDownColor: "#f87171" });
      volRef.current = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "", color: "#d3cec2" });
      volRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      chartRef.current = chart;
    })();
    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const j = await fetch(`/api/coin/${mint}/trades?tf=${tf}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (stop || !j || !seriesRef.current) return;
      const candles: Candle[] = j.candles || [];
      // Extend with the live market cap so the last candle tracks the pool between keeper ticks.
      if (liveMcap > 0) {
        const now = Math.floor(Date.now() / 1000 / tf) * tf;
        const last = candles[candles.length - 1];
        if (last && last.time === now) {
          last.close = liveMcap;
          last.high = Math.max(last.high, liveMcap);
          last.low = Math.min(last.low, liveMcap);
        } else if (last) candles.push({ time: now, open: last.close, high: Math.max(last.close, liveMcap), low: Math.min(last.close, liveMcap), close: liveMcap, volume: 0 });
      }
      seriesRef.current.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
      volRef.current.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "rgba(18,161,80,0.35)" : "rgba(216,69,47,0.35)" })));
      setCount(candles.length);
    };
    const wait = setInterval(() => {
      if (seriesRef.current) {
        clearInterval(wait);
        load();
      }
    }, 100);
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(wait);
      clearInterval(t);
    };
  }, [mint, tf, liveMcap]);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="row between" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
        <span className="h-card" style={{ margin: 0 }}>Market cap</span>
        <div className="tabs">
          {TFS.map((t) => (
            <button key={t.s} className={`tab ${tf === t.s ? "on" : ""}`} style={{ height: 28, fontSize: 12.5 }} onClick={() => setTf(t.s)}>
              {t.l}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-box">
        <div ref={box} style={{ position: "absolute", inset: 0 }} />
        {count === 0 ? <div className="chart-empty">No trades indexed yet. The chart fills in as people trade.</div> : null}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usd } from "@/lib/format";

type Stats = { coins: number; volume24hUsd: number; potSol: number; potUsd: number; nextPayoutAt: number; paidSol: number };

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : `${h}h ${m}m`;
}

/** One line under the hero: what is in this week's pot and when it is paid. */
export function PotBar() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/stats", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => !stop && setS(j))
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  return (
    <div className="p-sub">
      this week&apos;s trader pot: <b>{s ? `${s.potSol.toFixed(3)} SOL` : "…"}</b>
      {s && s.potUsd ? ` (${usd(s.potUsd)})` : ""} · paid in <b>{s ? left(s.nextPayoutAt - Date.now()) : "…"}</b> to the top 100 by volume ·{" "}
      <Link href="/rewards" className="bl green">
        leaderboard
      </Link>
    </div>
  );
}

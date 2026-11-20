"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { short, usd } from "@/lib/format";

type Trade = { mint: string; ticker: string; image?: string; s: "buy" | "sell"; usd: number; t: number; w: string };
type Event = { t: string; mint?: string; ticker?: string; at: number };

/** The two bubbles in the nav: the latest trade and the latest launch. Each shakes when it changes. */
export function Bubbles() {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [launch, setLaunch] = useState<Event | null>(null);
  const [shake, setShake] = useState({ trade: false, launch: false });
  const last = useRef({ trade: "", launch: "" });

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const j = await fetch("/api/activity", { cache: "no-store" }).then((r) => r.json());
        if (stop) return;
        const t: Trade | undefined = (j.trades || [])[0];
        const l: Event | undefined = (j.events || []).find((e: Event) => e.t === "launch");
        const tk = t ? `${t.t}${t.w}` : "";
        const lk = l ? `${l.at}${l.mint}` : "";
        const next = { trade: !!tk && tk !== last.current.trade, launch: !!lk && lk !== last.current.launch };
        last.current = { trade: tk, launch: lk };
        if (t) setTrade(t);
        if (l) setLaunch(l);
        if (next.trade || next.launch) {
          setShake(next);
          setTimeout(() => !stop && setShake({ trade: false, launch: false }), 600);
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 6000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  if (!trade && !launch) return null;
  return (
    <div className="bubbles hide-sm">
      {trade ? (
        <Link href={`/coin/${trade.mint}`} className={`bubble ${trade.s} ${shake.trade ? "shake" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {trade.image ? <img src={trade.image} alt="" /> : null}
          {short(trade.w)} {trade.s === "buy" ? "bought" : "sold"} {usd(trade.usd, 2)} of {trade.ticker}
        </Link>
      ) : null}
      {launch?.mint ? (
        <Link href={`/coin/${launch.mint}`} className={`bubble new ${shake.launch ? "shake" : ""}`}>
          {launch.ticker} was created
        </Link>
      ) : null}
    </div>
  );
}

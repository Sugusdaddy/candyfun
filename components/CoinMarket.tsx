"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { short, usd } from "@/lib/format";

type Row = {
  mint: string;
  name: string;
  ticker: string;
  image: string;
  description: string;
  pair: string;
  pairSymbol: string;
  launcher: string;
  createdAt: number;
  vampFeeSol: number;
  lastTradeAt: number;
  flags: { lookalikeOf: string[]; sameImageAs: string | null };
  mcapUsd: number;
  progress: number;
  graduated: boolean;
  volume24hUsd: number;
  grade: string | null;
  holders: number;
};

const SORTS = [
  { key: "bump", label: "sort: bump order" },
  { key: "new", label: "sort: creation time" },
  { key: "mcap", label: "sort: market cap" },
  { key: "graduating", label: "sort: closest to graduating" },
  { key: "graduated", label: "sort: graduated" },
];

const Crown = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fde047" aria-hidden="true">
    <path d="M3 18h18l1.5-10-5.5 4L12 4 7 12 1.5 8 3 18zm0 2h18v2H3v-2z" />
  </svg>
);

export function Tile({ r, bump = false }: { r: Row; bump?: boolean }) {
  const copy = r.vampFeeSol > 0 || r.flags?.lookalikeOf?.length || r.flags?.sameImageAs;
  return (
    <Link href={`/coin/${r.mint}`} className={`p-tile ${bump ? "bump" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="av" src={r.image} alt="" loading="lazy" />
      <div className="t">
        <div className="by">Created by {short(r.launcher)}</div>
        <div className="mc">
          market cap: {usd(r.mcapUsd)}
          <span className="tag">{r.pairSymbol}</span>
          {r.graduated ? <span className="tag">graduated</span> : null}
          {copy ? <span className="tag warn">copy</span> : null}
        </div>
        <div className="dim">
          {r.graduated ? "on Raydium" : `${(r.progress * 100).toFixed(1)}% to graduation`} · {r.holders || 0} holders
        </div>
        <div className="desc">
          <b>
            {r.name} (ticker: {r.ticker})
          </b>
          {r.description ? `: ${r.description.slice(0, 180)}` : ""}
        </div>
      </div>
    </Link>
  );
}

export function CoinMarket() {
  const [sort, setSort] = useState("bump");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [bumped, setBumped] = useState<string | null>(null);
  const seen = useRef<Record<string, number>>({});

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const feed = sort === "bump" ? "new" : sort;
        const j = await fetch(`/api/coins?feed=${feed}&limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json());
        if (stop) return;
        const list: Row[] = j.coins || [];
        // A coin whose last trade is newer than what we saw gets the shake.
        let hit: string | null = null;
        for (const r of list) {
          const prev = seen.current[r.mint];
          if (prev !== undefined && r.lastTradeAt > prev) hit = r.mint;
          seen.current[r.mint] = r.lastTradeAt || 0;
        }
        setRows(list);
        if (hit) {
          setBumped(hit);
          setTimeout(() => !stop && setBumped(null), 1300);
        }
      } catch {
        if (!stop) setRows((r) => r || []);
      }
    };
    load();
    const t = setInterval(load, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [sort, q]);

  // Bump order: the coin traded (or created) most recently comes first, like the original feed.
  const shown = useMemo(() => {
    const list = rows || [];
    return sort === "bump" ? [...list].sort((a, b) => Math.max(b.lastTradeAt, b.createdAt) - Math.max(a.lastTradeAt, a.createdAt)) : list;
  }, [rows, sort]);
  const king = useMemo(() => [...(rows || [])].filter((r) => !r.graduated).sort((a, b) => b.mcapUsd - a.mcapUsd)[0], [rows]);

  return (
    <section id="coins">
      {king && !q ? (
        <div className="koth">
          <div className="koth-title">
            <Crown /> king of the hill
          </div>
          <Tile r={king} bump={bumped === king.mint} />
        </div>
      ) : null}

      <div className="p-tools">
        <input className="search" placeholder="search for token" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort coins">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {rows === null ? (
        <div className="p-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 112 }} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          {q ? "no coin matches that. " : "no coins yet. "}
          <Link href="/create" className="bl green">
            start the first one
          </Link>
        </div>
      ) : (
        <div className="p-grid">
          {shown.map((r) => (
            <Tile key={r.mint} r={r} bump={bumped === r.mint} />
          ))}
        </div>
      )}
    </section>
  );
}

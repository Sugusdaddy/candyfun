"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { short, usd } from "@/lib/format";

type Row = { rank: number; wallet: string; usd: number; share: number; estSol: number };
type Past = { week: string; at: number; sol: number; wallets: number; totalUsd: number; sig: string };
type Data = { week: string; endsAt: number; traders: number; bots: number; totalUsd: number; potSol: number; potUsd: number; rows: Row[]; past: Past[] };

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function Leaderboard() {
  const { publicKey } = useWallet();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/leaderboard", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => !stop && setD(j))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  const me = publicKey?.toBase58();
  const mine = d?.rows.find((r) => r.wallet === me);
  return (
    <>
      <div className="p-box">
        <div className="kv"><span>pot so far (week of {d?.week || "…"})</span><b className="mono up">{d ? `${d.potSol.toFixed(4)} SOL${d.potUsd ? ` · ${usd(d.potUsd)}` : ""}` : "—"}</b></div>
        <div className="kv"><span>paid in</span><b className="mono">{d ? left(d.endsAt - Date.now()) : "—"}</b></div>
        <div className="kv"><span>volume this week</span><b className="mono">{d ? usd(d.totalUsd) : "—"}</b></div>
        <div className="kv"><span>wallets ranked</span><b className="mono">{d ? `${d.traders}${d.bots ? ` · ${d.bots} bots left out` : ""}` : "—"}</b></div>
        {me ? (
          <div className="kv"><span>you</span><b className="mono">{mine ? `#${mine.rank} · ~${mine.estSol.toFixed(4)} SOL so far` : "not in the top 100 yet"}</b></div>
        ) : null}
      </div>

      <h2>this week</h2>
      {!d ? (
        <div className="empty">loading…</div>
      ) : d.rows.length === 0 ? (
        <div className="empty">no volume yet this week. every trade on a candyfun coin counts, from any terminal.</div>
      ) : (
        <div className="table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th>#</th>
                <th>wallet</th>
                <th className="r">volume</th>
                <th className="r">share</th>
                <th className="r">est. airdrop</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.wallet} style={r.wallet === me ? { background: "var(--accent-soft)" } : undefined}>
                  <td className="dim mono">{r.rank}</td>
                  <td className="mono">
                    <a href={`https://solscan.io/account/${r.wallet}`} target="_blank" rel="noreferrer">
                      {short(r.wallet, 6)}
                    </a>
                    {r.wallet === me ? " (you)" : ""}
                  </td>
                  <td className="r mono">{usd(r.usd, 2)}</td>
                  <td className="r mono">{(r.share * 100).toFixed(2)}%</td>
                  <td className="r mono up">{r.estSol.toFixed(4)} SOL</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>past airdrops</h2>
      {!d?.past?.length ? (
        <div className="empty">the first airdrop goes out when the first week ends.</div>
      ) : (
        <div className="table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th>week of</th>
                <th className="r">paid</th>
                <th className="r">wallets</th>
                <th className="r">volume</th>
                <th className="r">tx</th>
              </tr>
            </thead>
            <tbody>
              {d.past.map((p) => (
                <tr key={p.week}>
                  <td className="mono">{p.week}</td>
                  <td className="r mono up">{p.sol.toFixed(4)} SOL</td>
                  <td className="r mono">{p.wallets}</td>
                  <td className="r mono">{usd(p.totalUsd)}</td>
                  <td className="r mono">
                    <a href={`https://solscan.io/tx/${p.sig}`} target="_blank" rel="noreferrer">
                      {p.sig.slice(0, 6)}… ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

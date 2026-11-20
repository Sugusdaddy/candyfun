"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GRAD_FEE_PCT, PLATFORM_FEE_PCT, RAYDIUM_FEE_PCT, TRADER_FEE_PCT } from "@/lib/config";
import { ago, amount, price, short, usd } from "@/lib/format";
import { TradePanel } from "./TradePanel";
import { PriceChart } from "./PriceChart";
import { IconCopy, IconExternal, IconGlobe, IconTelegram, IconX } from "./Icons";
import { toast } from "./Toast";

type Data = {
  coin: any;
  live: { priceUsd: number; mcapUsd: number; progress: number; graduated: boolean; raisedQuote: number; targetQuote: number; pairUsd: number; market: any; pool: any };
  bundle: any | null;
  rewards: Record<string, number>;
};

export function CoinView({ mint }: { mint: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<"trades" | "holders" | "safety">("trades");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const r = await fetch(`/api/coin/${mint}`, { cache: "no-store" }).catch(() => null);
      if (!r) return;
      if (r.status === 404) return !stop && setMissing(true);
      const j = await r.json();
      if (!stop) setD(j);
    };
    load();
    const t = setInterval(load, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [mint]);

  if (missing)
    return (
      <div className="wrap empty">
        This coin isn&apos;t on candyfun. <Link href="/" className="up">Back to coins</Link>
      </div>
    );
  if (!d)
    return (
      <div className="wrap" style={{ paddingTop: 30 }}>
        <div className="card skeleton" style={{ height: 120, marginBottom: 14 }} />
        <div className="card skeleton" style={{ height: 420 }} />
      </div>
    );

  const { coin, live, bundle } = d;
  const m = live.market || {};
  const ath = Math.max(m.athUsd || 0, live.mcapUsd);
  const devPct = (Number(coin.devBuyRaw || 0) / 1e15) * 100;
  const copy = () => {
    navigator.clipboard.writeText(coin.mint);
    toast("Contract address copied");
  };

  return (
    <div className="wrap">
      <div className="coin-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar" src={coin.image} alt="" />
        <div className="grow">
          <div className="row wrap-row" style={{ gap: 8 }}>
            <h1>${coin.ticker}</h1>
            <span className="chip">{coin.pairSymbol} pair</span>
            {coin.vampFeeSol ? <span className="chip chip-gold">copy · paid {coin.vampFeeSol} SOL vamp fee</span> : null}
            {live.graduated ? <span className="chip chip-gold">graduated</span> : <span className="chip">bonding</span>}
            {bundle ? <span className={`grade grade-${bundle.grade}`}>{bundle.grade}</span> : null}
          </div>
          <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            {coin.name} · launched {ago(coin.createdAt)} by{" "}
            <a className="mono" href={`https://solscan.io/account/${coin.launcher}`} target="_blank" rel="noreferrer">
              {short(coin.launcher)}
            </a>{" "}
          </div>
          <div className="row wrap-row" style={{ gap: 6, marginTop: 12 }}>
            <button className="btn btn-sm mono" onClick={copy}>
              {short(coin.mint, 5)} <IconCopy size={14} />
            </button>
            <a className="btn btn-sm" href={`https://solscan.io/tx/${coin.createSig}`} target="_blank" rel="noreferrer">
              Creation tx <IconExternal size={14} />
            </a>
            {coin.twitter ? (
              <a className="btn btn-sm" href={coin.twitter} target="_blank" rel="noreferrer" aria-label="X">
                <IconX size={14} />
              </a>
            ) : null}
            {coin.telegram ? (
              <a className="btn btn-sm" href={coin.telegram} target="_blank" rel="noreferrer" aria-label="Telegram">
                <IconTelegram size={15} />
              </a>
            ) : null}
            {coin.website ? (
              <a className="btn btn-sm" href={coin.website} target="_blank" rel="noreferrer" aria-label="Website">
                <IconGlobe size={15} />
              </a>
            ) : null}
            {coin.tweetUrl ? (
              <a className="btn btn-sm" href={coin.tweetUrl} target="_blank" rel="noreferrer">
                Launch tweet
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {coin.flags?.lookalikeOf?.length ? (
        <div className="notice warn" style={{ marginBottom: 12 }}>
          Possible copy: this ticker looks like {coin.flags.lookalikeOf.length} recent coin(s) on candyfun (
          {coin.flags.lookalikeOf.map((x: string, i: number) => (
            <span key={x}>
              {i ? ", " : ""}
              <Link href={`/coin/${x}`} className="up mono">
                {short(x)}
              </Link>
            </span>
          ))}
          ). Check the contract address before you buy.
        </div>
      ) : null}
      {coin.flags?.sameImageAs ? (
        <div className="notice warn" style={{ marginBottom: 12 }}>
          Same image as an earlier coin:{" "}
          <Link href={`/coin/${coin.flags.sameImageAs}`} className="up mono">
            {short(coin.flags.sameImageAs)}
          </Link>
        </div>
      ) : null}

      <div className="coin-grid">
        <div className="col" style={{ gap: 14, minWidth: 0 }}>
          <div className="stats">
            <div>
              <div className="k">Price</div>
              <div className="v">{price(live.priceUsd)}</div>
            </div>
            <div>
              <div className="k">Market cap</div>
              <div className="v">{usd(live.mcapUsd)}</div>
            </div>
            <div>
              <div className="k">ATH</div>
              <div className="v">{usd(ath)}</div>
            </div>
            <div>
              <div className="k">24h volume</div>
              <div className="v">{usd(m.volume24hUsd || 0)}</div>
            </div>
            <div>
              <div className="k">Holders</div>
              <div className="v">{m.holders ? amount(m.holders, 0) : "—"}</div>
            </div>
          </div>

          <div className="card pad">
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="kicker">{live.graduated ? "Graduated to Raydium" : "Bonding curve"}</span>
              <b className="mono">{live.graduated ? "100%" : `${(live.progress * 100).toFixed(2)}%`}</b>
            </div>
            <div className={`bar ${live.graduated ? "done" : ""}`} style={{ height: 8 }}>
              <i style={{ width: `${live.graduated ? 100 : Math.max(1, live.progress * 100)}%` }} />
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              {live.graduated
                ? "Liquidity migrated to a Raydium CPMM pool and the LP tokens were burned."
                : `${amount(live.raisedQuote, 2)} / ${amount(live.targetQuote, 2)} ${coin.pairSymbol} in the curve · started at ${usd(coin.curve.startMcapUsd, 0)} · graduates at ${usd(coin.curve.gradMcapUsd, 0)}`}
            </div>
          </div>

          <PriceChart mint={coin.mint} liveMcap={live.mcapUsd} />

          <div className="card">
            <div className="tabs" style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
              <button className={`tab ${tab === "trades" ? "on" : ""}`} onClick={() => setTab("trades")}>
                Trades
              </button>
              <button className={`tab ${tab === "holders" ? "on" : ""}`} onClick={() => setTab("holders")}>
                Top holders
              </button>
              <button className={`tab ${tab === "safety" ? "on" : ""}`} onClick={() => setTab("safety")}>
                Bundle check {bundle ? `· ${bundle.grade}` : ""}
              </button>
            </div>
            {tab === "trades" ? <TradesTable mint={coin.mint} ticker={coin.ticker} /> : null}
            {tab === "holders" ? <Holders top={m.topHolders || []} launcher={coin.launcher} bundle={bundle} /> : null}
            {tab === "safety" ? <Safety bundle={bundle} createdAt={coin.createdAt} /> : null}
          </div>

          <div className="card pad">
            <div className="h-card">Fees on this coin</div>
            <div className="kv">
              <span>Raydium protocol fee</span>
              <b className="mono">{RAYDIUM_FEE_PCT}%</b>
            </div>
            <div className="kv">
              <span>Candyfun fee, airdropped weekly to top traders</span>
              <b className="mono up">{PLATFORM_FEE_PCT}%</b>
            </div>
            <div className="kv">
              <span>Creator fee</span>
              <b>none</b>
            </div>
            <div className="kv">
              <span>Sent to the trader pot so far</span>
              <b className="mono">
                {amount(d.rewards?.fees || 0, 4)} {coin.pairSymbol}
              </b>
            </div>
            <div className="dim" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.55 }}>
              {TRADER_FEE_PCT}% per trade on the curve, {GRAD_FEE_PCT}% on Raydium after graduation. <Link href="/rewards" className="up">See the leaderboard</Link>
            </div>
          </div>

          <div className="card pad">
            <div className="h-card">Launch facts</div>
            <div className="kv">
              <span>Created by</span>
              <b className="mono">{short(coin.launcher, 5)} (their own wallet)</b>
            </div>
            <div className="kv">
              <span>Creator&apos;s buy in the launch transaction</span>
              <b className={devPct > 0 ? "gold" : "up"}>{devPct > 0 ? `${devPct.toFixed(2)}% of supply` : "none"}</b>
            </div>
            <div className="kv">
              <span>Mint and freeze authority</span>
              <b>none</b>
            </div>
            <div className="kv">
              <span>Liquidity</span>
              <b>LP burned at graduation</b>
            </div>
            <div className="kv">
              <span>Vamp fee paid</span>
              <b>{coin.vampFeeSol ? `${coin.vampFeeSol} SOL (copies an earlier coin)` : "none, original"}</b>
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 14, position: "sticky", top: 84 }}>
          <TradePanel
            mint={coin.mint}
            ticker={coin.ticker}
            pair={coin.pair}
            pairSymbol={coin.pairSymbol}
            pairDecimals={coin.pairDecimals}
            graduated={live.graduated}
            feePct={live.graduated ? GRAD_FEE_PCT : TRADER_FEE_PCT}
            priceUsd={live.priceUsd}
            pairUsd={live.pairUsd}
          />
          {coin.description ? (
            <div className="card pad">
              <div className="h-card">About</div>
              <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap", fontSize: 14.5 }}>{coin.description}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TradesTable({ mint, ticker }: { mint: string; ticker: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/coin/${mint}/trades?tf=300`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => !stop && setRows(j.trades || []))
        .catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [mint]);
  if (!rows) return <div className="empty pulse">Loading trades…</div>;
  if (!rows.length) return <div className="empty">No trades indexed yet.</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Side</th>
            <th className="r">USD</th>
            <th className="r">${ticker}</th>
            <th>Trader</th>
            <th className="r">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((t) => (
            <tr key={t.sig}>
              <td className={t.s === "buy" ? "side-buy" : "side-sell"}>{t.s === "buy" ? "Buy" : "Sell"}</td>
              <td className="r mono">{usd(t.usd, 2)}</td>
              <td className="r mono">{amount(t.tokens, 0)}</td>
              <td className="mono">
                <a href={`https://solscan.io/tx/${t.sig}`} target="_blank" rel="noreferrer">
                  {short(t.w)}
                </a>
              </td>
              <td className="r dim">{ago(t.t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Holders({ top, launcher, bundle }: { top: { w: string; pct: number }[]; launcher: string; bundle: any }) {
  if (!top.length) return <div className="empty">Holder snapshot runs every few minutes.</div>;
  const linked = new Set((bundle?.buyers || []).filter((b: any) => b.linked).map((b: any) => b.wallet));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Wallet</th>
            <th className="r">Share of supply</th>
          </tr>
        </thead>
        <tbody>
          {top.map((h, i) => (
            <tr key={h.w}>
              <td className="dim mono">{i + 1}</td>
              <td className="mono">
                <a href={`https://solscan.io/account/${h.w}`} target="_blank" rel="noreferrer">
                  {short(h.w, 5)}
                </a>{" "}
                {h.w === launcher ? <span className="chip chip-gold">dev</span> : null} {linked.has(h.w) ? <span className="chip chip-red">linked</span> : null}
              </td>
              <td className="r mono">{h.pct.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dim" style={{ fontSize: 12, padding: "8px 12px" }}>
        Pool vaults and the fee wallet are left out.
      </div>
    </div>
  );
}

function Safety({ bundle, createdAt }: { bundle: any | null; createdAt: number }) {
  if (!bundle)
    return (
      <div className="pad row" style={{ gap: 14 }}>
        <div className="grade lg grade-x">?</div>
        <div className="muted" style={{ fontSize: 14 }}>
          {Date.now() - createdAt < 5 * 60_000 ? "The bundle check traces every early buyer about 90 seconds after launch." : "The bundle check hasn't run for this coin yet."}
        </div>
      </div>
    );
  const linked = bundle.buyers.filter((b: any) => b.linked);
  return (
    <div>
      <div className="pad row" style={{ gap: 14 }}>
        <div className={`grade lg grade-${bundle.grade}`}>{bundle.grade}</div>
        <div>
          <b>{linked.length ? `${linked.length} linked early buyer${linked.length > 1 ? "s" : ""}` : "No linked buyers"}</b>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 3 }}>
            {bundle.buyers.length} wallets bought in the first {bundle.slots} slots
            {linked.length ? `; linked ones still hold ${bundle.linkedHoldPct.toFixed(2)}% of supply.` : ". None trace back to the launcher or to each other."}
          </div>
          <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>{(bundle.gradeWhy || []).join(" · ")}</div>
        </div>
      </div>
      {bundle.buyers.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Early buyer</th>
                <th>Slot</th>
                <th>Funded by</th>
                <th className="r">Holds</th>
              </tr>
            </thead>
            <tbody>
              {bundle.buyers.slice(0, 20).map((b: any) => (
                <tr key={b.wallet}>
                  <td className="mono">
                    {short(b.wallet)} {b.linked ? <span className="chip chip-red" title={b.reason}>linked</span> : null}
                  </td>
                  <td className="mono dim">+{b.slot}</td>
                  <td className="mono dim">{b.funder ? short(b.funder) : "—"}</td>
                  <td className="r mono">{b.holdsPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

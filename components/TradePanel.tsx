"use client";

import { useEffect, useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SOL_MINT } from "@/lib/config";
import { amount, usd } from "@/lib/format";
import { toast } from "./Toast";

type Props = {
  mint: string;
  ticker: string;
  pair: string;
  pairSymbol: string;
  pairDecimals: number;
  graduated: boolean;
  feePct: number;
  priceUsd: number;
  pairUsd: number;
};

export function TradePanel(props: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const solPair = props.pair === SOL_MINT;
  const [payWith, setPayWith] = useState<"sol" | "pair">("sol");
  const [value, setValue] = useState("");
  const [slip, setSlip] = useState(3);
  const [busy, setBusy] = useState(false);
  const [bal, setBal] = useState({ sol: 0, token: 0, pair: 0 });

  const usingSol = solPair || payWith === "sol";
  const payDecimals = usingSol ? 9 : props.pairDecimals;
  const paySymbol = usingSol ? "SOL" : props.pairSymbol;

  useEffect(() => {
    if (!wallet.publicKey) return;
    let stop = false;
    const load = async () => {
      try {
        const owner = wallet.publicKey!;
        const empty = { value: [] as any[] };
        const [sol, classic, t22] = await Promise.all([
          connection.getBalance(owner),
          connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }).catch(() => empty),
          solPair ? Promise.resolve(empty) : connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }).catch(() => empty),
        ]);
        let token = 0;
        let pair = 0;
        for (const a of [...classic.value, ...t22.value]) {
          const info = a.account.data.parsed?.info;
          if (info?.mint === props.mint) token += Number(info.tokenAmount.uiAmount || 0);
          if (info?.mint === props.pair) pair += Number(info.tokenAmount.uiAmount || 0);
        }
        if (!stop) setBal({ sol: sol / 1e9, token, pair });
      } catch {}
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [wallet.publicKey, connection, props.mint, props.pair, solPair]);

  // Rough estimate (the transaction itself carries the exact minimum).
  const n = Number(value) || 0;
  let estimate = "";
  if (n > 0 && props.priceUsd > 0) {
    const fee = 1 - props.feePct / 100;
    if (side === "buy" && (!usingSol || solPair) && props.pairUsd > 0) estimate = `≈ ${amount((n * props.pairUsd * fee) / props.priceUsd, 0)} $${props.ticker}`;
    else if (side === "sell") estimate = `≈ ${usd(n * props.priceUsd * fee, 2)}`;
    else estimate = "Routed SOL → " + props.pairSymbol + " → curve in one transaction";
  }

  async function go() {
    if (!wallet.publicKey || !wallet.signTransaction) return setVisible(true);
    if (!(n > 0)) return toast("Enter an amount");
    setBusy(true);
    try {
      const raw = side === "buy" ? BigInt(Math.floor(n * 10 ** payDecimals)) : BigInt(Math.floor(n * 1e6));
      const r = await fetch("/api/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: props.mint, owner: wallet.publicKey.toBase58(), side, amount: raw.toString(), payWith: solPair ? "pair" : payWith, slippageBps: Math.round(slip * 100) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Trade failed");
      const tx = VersionedTransaction.deserialize(Buffer.from(j.tx, "base64"));
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      toast("Sent, confirming…");
      const bh = await connection.getLatestBlockhash();
      const conf = await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      if (conf.value.err) throw new Error("Trade failed on-chain");
      toast(`${side === "buy" ? "Bought" : "Sold"} $${props.ticker}`, `https://solscan.io/tx/${sig}`);
      setValue("");
    } catch (e: any) {
      toast(String(e?.message || e).slice(0, 140));
    } finally {
      setBusy(false);
    }
  }

  if (props.graduated)
    return (
      <div className="card pad">
        <div className="h-card">Trade</div>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          ${props.ticker} graduated to a Raydium pool with burned liquidity. Trade it on any aggregator.
        </p>
        <a className="btn btn-accent btn-block" href={`https://jup.ag/swap/SOL-${props.mint}`} target="_blank" rel="noreferrer">
          Trade on Jupiter
        </a>
      </div>
    );

  const quick = side === "buy" ? (paySymbol === "SOL" ? ["0.1", "0.5", "1", "5"] : ["10", "50", "100", "500"]) : ["25%", "50%", "75%", "100%"];
  const balance = side === "buy" ? (paySymbol === "SOL" ? bal.sol : bal.pair) : bal.token;
  return (
    <div className="card pad col" style={{ gap: 12 }}>
      <div className="seg">
        <button className={`buy ${side === "buy" ? "on" : ""}`} onClick={() => setSide("buy")}>
          Buy
        </button>
        <button className={`sell ${side === "sell" ? "on" : ""}`} onClick={() => setSide("sell")}>
          Sell
        </button>
      </div>
      {!solPair ? (
        <div className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {side === "buy" ? "Pay with" : "Receive"}
          </span>
          <button className={`pair ${payWith === "sol" ? "on" : ""}`} onClick={() => setPayWith("sol")}>
            SOL
          </button>
          <button className={`pair ${payWith === "pair" ? "on" : ""}`} onClick={() => setPayWith("pair")}>
            {props.pairSymbol}
          </button>
        </div>
      ) : null}
      <div>
        <div className="amount">
          <input inputMode="decimal" placeholder="0.0" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} />
          <b className="muted mono">{side === "buy" ? paySymbol : "$" + props.ticker}</b>
        </div>
        <div className="row between dim" style={{ fontSize: 12, marginTop: 7 }}>
          <span>
            Balance{" "}
            <button className="mono" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }} onClick={() => setValue(String(side === "buy" ? Math.max(0, balance - (paySymbol === "SOL" ? 0.01 : 0)).toFixed(4) : Math.floor(balance)))}>
              {amount(balance)} {side === "buy" ? paySymbol : ""}
            </button>
          </span>
          <span>
            slippage{" "}
            <input
              value={slip}
              onChange={(e) => setSlip(Math.max(0.1, Math.min(50, Number(e.target.value) || 3)))}
              style={{ width: 30, background: "transparent", border: "none", color: "var(--muted)", textAlign: "right", fontFamily: "var(--mono)" }}
            />
            %
          </span>
        </div>
      </div>
      <div className="quick">
        {quick.map((q) => (
          <button key={q} className="btn btn-sm" onClick={() => (q.endsWith("%") ? setValue(String(Math.floor(bal.token * (Number(q.slice(0, -1)) / 100)))) : setValue(q))}>
            {q}
          </button>
        ))}
      </div>
      {estimate ? <div className="muted mono" style={{ fontSize: 13 }}>{estimate}</div> : null}
      <button className={`btn btn-lg btn-block ${side === "buy" ? "btn-accent" : "btn-red"}`} disabled={busy} onClick={go}>
        {busy ? <span className="spin" /> : null}
        {!wallet.publicKey ? "Connect wallet" : side === "buy" ? `Buy $${props.ticker}` : `Sell $${props.ticker}`}
      </button>
      <div className="dim" style={{ fontSize: 12 }}>
        {props.feePct}% fee · settles on the coin&apos;s own Raydium LaunchLab pool
      </div>
    </div>
  );
}

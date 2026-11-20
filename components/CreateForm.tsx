"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { GRAD_MULTIPLE, MAX_DEV_BUY_PCT, NETWORK_COST_SOL, START_MCAP_USD, TRADER_FEE_PCT, VAMP_FEE_TIERS } from "@/lib/config";
import { amount, usd } from "@/lib/format";
import { GROUP_LABEL } from "@/lib/pairs";

type PairRow = { mint: string; symbol: string; name: string; group: "crypto" | "stocks" | "preipo"; decimals: number; priceUsd: number; raise: number; icon?: string };
type Check = { ok: boolean; feeSol: number; reason: string | null; lookalikes: string[] };

/** Shrink big images client-side so uploads stay small (GIFs are kept as they are). */
async function readImage(file: File, maxSide: number, maxBytes: number): Promise<string> {
  const raw: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (file.type === "image/gif") {
    if (file.size > maxBytes) throw new Error("GIF is too big (max 1.4 MB)");
    return raw;
  }
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = raw;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1 && file.size <= maxBytes) return raw;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/webp", 0.88);
}

export function CreateForm() {
  const router = useRouter();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [tweetUrl, setTweetUrl] = useState("");
  const [more, setMore] = useState(false);
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [enabled, setEnabled] = useState(0);
  const [group, setGroup] = useState<"crypto" | "stocks" | "preipo" | "custom">("crypto");
  const [pair, setPair] = useState<PairRow | null>(null);
  const [customMint, setCustomMint] = useState("");
  const [customErr, setCustomErr] = useState<string | null>(null);
  const [devBuy, setDevBuy] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pairs")
      .then((r) => r.json())
      .then((j) => {
        setPairs(j.pairs || []);
        setEnabled(j.enabled || 0);
        setPair((p) => p || (j.pairs || [])[0] || null);
      })
      .catch(() => {});
  }, []);

  // Live anti-vamp quote.
  useEffect(() => {
    if (!ticker && !name && !tweetUrl) return setCheck(null);
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ ticker, name, tweet: tweetUrl });
      const j = await fetch(`/api/launch/check?${q}`).then((r) => r.json()).catch(() => null);
      if (j) setCheck(j);
    }, 350);
    return () => clearTimeout(t);
  }, [ticker, name, tweetUrl]);

  useEffect(() => {
    if (group !== "custom" || customMint.length < 32) return;
    setCustomErr(null);
    const t = setTimeout(async () => {
      const j = await fetch(`/api/pairs?mint=${customMint.trim()}`).then((r) => r.json()).catch(() => null);
      if (!j?.ok) {
        setCustomErr(j?.error || "Can't use this token");
        setPair(null);
      } else setPair({ ...j.pair, group: "crypto" });
    }, 400);
    return () => clearTimeout(t);
  }, [customMint, group]);

  const shown = useMemo(() => pairs.filter((p) => p.group === group), [pairs, group]);
  const tickerOk = /^[A-Z0-9]{2,10}$/.test(ticker);
  const vampFee = check?.feeSol || 0;
  const devBuyNum = Number(devBuy) || 0;
  const ready = !!image && name.trim().length > 0 && tickerOk && !!pair && !busy;

  async function launch() {
    setError(null);
    if (!wallet.publicKey || !wallet.signTransaction) return setVisible(true);
    if (!ready || !pair) return;
    let launchId = "";
    try {
      // The mint keypair is made here, in the browser, and signs after the wallet does.
      const mintKp = Keypair.generate();
      setBusy("building your launch transaction…");
      const devBuyRaw = devBuyNum > 0 ? BigInt(Math.round(devBuyNum * 10 ** pair.decimals)).toString() : "0";
      const r = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payer: wallet.publicKey.toBase58(),
          mint: mintKp.publicKey.toBase58(),
          name, ticker, description, website, twitter, telegram, tweetUrl,
          pair: pair.mint, pairSymbol: pair.symbol, image, devBuyRaw,
          acceptVampFeeSol: vampFee,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        // Someone launched this ticker while the form was open: show the new price instead of charging it silently.
        if (j.vampFeeSol) setCheck({ ok: true, feeSol: j.vampFeeSol, reason: j.error, lookalikes: [] });
        throw new Error(j.error || "Launch failed");
      }
      launchId = j.launchId;
      setBusy("approve the transaction in your wallet…");
      const tx = VersionedTransaction.deserialize(Buffer.from(j.tx, "base64"));
      const signed = await wallet.signTransaction(tx);
      signed.sign([mintKp]);
      setBusy("creating your coin on Raydium…");
      const s = await fetch("/api/launch/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ launchId, signedTx: Buffer.from(signed.serialize()).toString("base64") }),
      });
      const sj = await s.json();
      if (!s.ok) throw new Error(sj.error || "Creation failed");
      router.push(`/coin/${sj.mint}?new=1`);
    } catch (e: any) {
      if (launchId) fetch(`/api/launch?id=${launchId}`, { method: "DELETE" }).catch(() => {});
      setError(String(e?.message || e).replace(/^Error: /, ""));
      setBusy(null);
    }
  }

  return (
    <div className="form-grid">
      <div className="col" style={{ gap: 16 }}>
        <div className="field">
          <label>name</label>
          <input className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>ticker</label>
          <input className={`input ${ticker && !tickerOk ? "err" : ""}`} maxLength={10} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          {vampFee > 0 ? (
            <div className="notice warn" style={{ marginTop: 8 }}>{check?.reason}</div>
          ) : check && ticker && tickerOk ? (
            <div className="hint" style={{ marginTop: 6 }}>
              {check.lookalikes?.length ? `looks like ${check.lookalikes.map((t) => "$" + t).join(", ")}: allowed, but flagged as a possible copy.` : `$${ticker} is unused: launching it is free.`}
            </div>
          ) : null}
        </div>
        <div className="field">
          <label>description</label>
          <textarea className="input" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>image</label>
          <div className="drop" onClick={() => fileRef.current?.click()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image ? <img src={image} alt="" /> : <div className="ph">+</div>}
            <div>
              <b>{image ? "change image" : "drop or click to upload"}</b>
              <div className="hint">PNG, JPG, WebP or GIF · square works best</div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setImage(await readImage(f, 1000, 1_400_000));
              } catch (err: any) {
                setError(err.message);
              }
            }}
          />
        </div>

        <div className="field">
          <label>pair (what your coin trades against)</label>
          <div className="tabs" style={{ marginBottom: 10 }}>
            {(["crypto", "stocks", "preipo", "custom"] as const).map((g) => (
              <button key={g} type="button" className={`tab ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>
                {g === "custom" ? "any token" : GROUP_LABEL[g].toLowerCase()}
              </button>
            ))}
          </div>
          {group === "custom" ? (
            <>
              <input className={`input mono ${customErr ? "err" : ""}`} value={customMint} onChange={(e) => setCustomMint(e.target.value.trim())} placeholder="paste a token mint address" />
              <div className="hint" style={{ marginTop: 7, color: customErr ? "var(--red)" : undefined }}>
                {customErr ||
                  (pair && customMint
                    ? `$${pair.symbol} works as a pair`
                    : `works with every token Raydium has enabled for LaunchLab${enabled ? ` (${enabled} today)` : ""}. Raydium decides that list, not us.`)}
              </div>
            </>
          ) : (
            <div className="pairs-wall">
              {shown.map((p) => (
                <button key={p.mint} type="button" className={`pair ${pair?.mint === p.mint ? "on" : ""} ${p.icon ? "" : "plain"}`} onClick={() => setPair(p)} title={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.icon ? <img src={p.icon} alt="" /> : null}
                  {p.symbol}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>buy first (optional){pair ? `, in ${pair.symbol}` : ""}</label>
          <input className="input mono" inputMode="decimal" value={devBuy} onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
          <div className="hint" style={{ marginTop: 6 }}>
            your own buy inside the launch transaction, before anyone else. at most {MAX_DEV_BUY_PCT}% of the supply, shown on the coin page.
            {devBuyNum > 0 && pair?.priceUsd ? ` ≈ ${usd(devBuyNum * pair.priceUsd, 2)}` : ""}
          </div>
        </div>

        <button type="button" className="bl blue" style={{ alignSelf: "flex-start" }} onClick={() => setMore((m) => !m)}>
          {more ? "hide more options" : "show more options"}
        </button>
        {more ? (
          <>
            <div className="field">
              <label>twitter link</label>
              <input className="input" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="(optional)" />
            </div>
            <div className="field">
              <label>telegram link</label>
              <input className="input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="(optional)" />
            </div>
            <div className="field">
              <label>website</label>
              <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="(optional)" />
            </div>
            <div className="field">
              <label>launch tweet</label>
              <input className="input" value={tweetUrl} onChange={(e) => setTweetUrl(e.target.value)} placeholder="https://x.com/you/status/… (optional)" />
              <div className="hint" style={{ marginTop: 6 }}>the first coin launched from a tweet is free; copies of it pay the vamp fee too.</div>
            </div>
          </>
        ) : null}
      </div>

      <div className="summary">
        <div className="p-box">
          <div className="kv"><span>starts at</span><b className="mono">{usd(START_MCAP_USD, 0)} mcap</b></div>
          <div className="kv"><span>graduates at</span><b className="mono">{usd(START_MCAP_USD * GRAD_MULTIPLE, 0)} mcap</b></div>
          <div className="kv"><span>curve raise</span><b className="mono">{pair?.raise ? `${amount(pair.raise, 2)} ${pair.symbol}` : "—"}</b></div>
          <div className="kv"><span>trading fee</span><b className="mono">{TRADER_FEE_PCT}%</b></div>
          <div className="kv"><span>launch fee</span><b className="up">free</b></div>
          <div className="kv"><span>vamp fee</span><b className={`mono ${vampFee ? "gold" : "up"}`}>{vampFee ? `${vampFee} SOL` : "none"}</b></div>
          <div className="kv"><span>solana rent + network</span><b className="mono">~{NETWORK_COST_SOL} SOL</b></div>

          {error ? <div className="notice err" style={{ margin: "12px 0 0" }}>{error}</div> : null}
          {busy ? (
            <div className="notice ok row" style={{ margin: "12px 0 0" }}>
              <span className="spin" /> {busy}
            </div>
          ) : null}

          <button className="btn btn-accent btn-lg btn-block" style={{ marginTop: 14 }} disabled={!!busy || (!!wallet.publicKey && !ready)} onClick={launch}>
            {!wallet.publicKey ? "connect wallet" : busy ? "creating…" : vampFee ? `create coin (${vampFee} SOL vamp fee)` : "create coin"}
          </button>
          <div className="hint" style={{ marginTop: 12 }}>
            your wallet creates the coin itself, directly on Raydium LaunchLab. nothing is paid to candyfun.
          </div>
        </div>

        <div className="p-box" style={{ marginTop: 12 }}>
          <b>copying a ticker costs</b>
          <div className="hint" style={{ margin: "4px 0 8px" }}>by the age of the coin you copy. all of it goes to the trader pot.</div>
          {VAMP_FEE_TIERS.map((t) => (
            <div key={t.label} className="kv">
              <span>{t.label}</span>
              <b className="mono">{t.sol} SOL</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// node --test keeper/test/
import test from "node:test";
import assert from "node:assert/strict";

process.env.KV_MEMORY = "0";
process.env.KV_HTTP = "http://unused.invalid";
const { planWeek } = await import("../lib/payouts.mjs");
const { weekKey } = await import("../lib/indexer.mjs");

const SOL = 1_000_000_000n;
const base = { week: "2026-11-16", bots: new Set(), topN: 100, minPayoutLamports: 1_000_000n };

test("pot is shared pro rata by volume", () => {
  const p = planWeek({ ...base, volumes: { A: "300", B: "100" }, potLamports: 4n * SOL });
  assert.equal(p.status, "paying");
  assert.deepEqual(p.rows.map((r) => [r.w, r.lamports]), [["A", "3000000000"], ["B", "1000000000"]]);
});

test("never pays more than the pot", () => {
  const volumes = Object.fromEntries(Array.from({ length: 97 }, (_, i) => [`W${i}`, (Math.PI * (i + 1)).toFixed(4)]));
  const pot = 7_777_777_777n;
  const p = planWeek({ ...base, volumes, potLamports: pot });
  const paid = p.rows.reduce((a, r) => a + BigInt(r.lamports), 0n);
  assert.ok(paid <= pot);
  assert.equal(paid.toString(), p.payingLamports);
  assert.ok(pot - paid < 200n, "only rounding dust is left");
});

test("only the top N by volume are paid", () => {
  const volumes = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`W${i}`, String(1000 - i)]));
  const p = planWeek({ ...base, volumes, potLamports: 100n * SOL });
  assert.equal(p.rows.length, 100);
  assert.equal(p.rows[0].w, "W0");
  assert.ok(!p.rows.some((r) => r.w === "W100"));
});

test("bots are left out and their share goes to the others", () => {
  const p = planWeek({ ...base, volumes: { BOT: "1000000", A: "50", B: "50" }, bots: new Set(["BOT"]), potLamports: 2n * SOL });
  assert.deepEqual(p.rows.map((r) => [r.w, r.lamports]), [["A", "1000000000"], ["B", "1000000000"]]);
});

test("shares under the minimum stay in the pot", () => {
  const p = planWeek({ ...base, volumes: { A: "1000000", DUST: "0.5" }, potLamports: 1n * SOL });
  assert.deepEqual(p.rows.map((r) => r.w), ["A"]);
  assert.ok(BigInt(p.payingLamports) < 1n * SOL);
});

test("nobody eligible: nothing is paid", () => {
  const p = planWeek({ ...base, volumes: { BOT: "10" }, bots: new Set(["BOT"]), potLamports: 1n * SOL });
  assert.equal(p.status, "skipped");
  assert.equal(p.payingLamports, "0");
});

test("weeks start Monday 00:00 UTC", () => {
  assert.equal(weekKey(Date.UTC(2026, 10, 20, 12)), "2026-11-16"); // a Friday
  assert.equal(weekKey(Date.UTC(2026, 10, 22, 23, 59)), "2026-11-16"); // Sunday night
  assert.equal(weekKey(Date.UTC(2026, 10, 23, 0, 0)), "2026-11-23"); // Monday
});

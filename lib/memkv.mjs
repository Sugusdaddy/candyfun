// In-memory stand-in for Redis, for local runs only (KV_MEMORY=1). Implements the handful of
// commands the keeper and the web use, with Redis' reply shapes.
const db = (globalThis.__runMemKv ||= new Map());
const exp = (globalThis.__runMemKvExp ||= new Map());

function live(k) {
  const t = exp.get(k);
  if (t && t < Date.now()) {
    db.delete(k);
    exp.delete(k);
  }
  return db.get(k);
}
const hash = (k) => {
  let h = live(k);
  if (!(h instanceof Map)) db.set(k, (h = new Map()));
  return h;
};
const list = (k) => {
  let l = live(k);
  if (!Array.isArray(l)) db.set(k, (l = []));
  return l;
};
const range = (l, a, b) => l.slice(Number(a), Number(b) === -1 ? undefined : Number(b) + 1);

export function memKv(cmd) {
  const [name, ...a] = cmd.map((x) => (typeof x === "number" ? String(x) : x));
  switch (String(name).toUpperCase()) {
    case "GET":
      return live(a[0]) ?? null;
    case "MGET":
      return a.map((k) => (typeof live(k) === "string" ? live(k) : null));
    case "SET": {
      const opts = a.slice(2).map((x) => String(x).toUpperCase());
      if (opts.includes("NX") && live(a[0]) !== undefined) return null;
      db.set(a[0], String(a[1]));
      const ex = opts.indexOf("EX");
      if (ex >= 0) exp.set(a[0], Date.now() + Number(a[2 + ex + 1]) * 1000);
      else exp.delete(a[0]);
      return "OK";
    }
    case "DEL":
      return a.reduce((n, k) => n + (db.delete(k) ? 1 : 0), 0);
    case "INCR": {
      const v = Number(live(a[0]) || 0) + 1;
      db.set(a[0], String(v));
      return v;
    }
    case "LPUSH": {
      const l = list(a[0]);
      for (const v of a.slice(1)) l.unshift(String(v));
      return l.length;
    }
    case "LRANGE":
      return range(list(a[0]), a[1], a[2]);
    case "LTRIM": {
      db.set(a[0], range(list(a[0]), a[1], a[2]));
      return "OK";
    }
    case "LREM": {
      const l = list(a[0]);
      const i = l.indexOf(String(a[2]));
      if (i >= 0) l.splice(i, 1);
      return i >= 0 ? 1 : 0;
    }
    case "HGET":
      return hash(a[0]).get(a[1]) ?? null;
    case "HGETALL":
      return [...hash(a[0]).entries()].flat();
    case "HSET": {
      const h = hash(a[0]);
      for (let i = 1; i < a.length; i += 2) h.set(a[i], String(a[i + 1]));
      return (a.length - 1) / 2;
    }
    case "HDEL":
      return a.slice(1).reduce((n, f) => n + (hash(a[0]).delete(f) ? 1 : 0), 0);
    case "HINCRBY": {
      const h = hash(a[0]);
      const v = Number(h.get(a[1]) || 0) + Number(a[2]);
      h.set(a[1], String(v));
      return v;
    }
    case "EXPIRE": {
      if (live(a[0]) === undefined) return 0;
      exp.set(a[0], Date.now() + Number(a[1]) * 1000);
      return 1;
    }
    case "EXISTS":
      return a.reduce((n, k) => n + (live(k) !== undefined ? 1 : 0), 0);
    case "LLEN":
      return list(a[0]).length;
    case "INCRBYFLOAT": {
      const v = Number(live(a[0]) || 0) + Number(a[1]);
      db.set(a[0], String(v));
      return String(v);
    }
    case "HINCRBYFLOAT": {
      const h = hash(a[0]);
      const v = Number(h.get(a[1]) || 0) + Number(a[2]);
      h.set(a[1], String(v));
      return String(v);
    }
    case "HMGET":
      return a.slice(1).map((f) => hash(a[0]).get(f) ?? null);
    case "SADD": {
      let s = live(a[0]);
      if (!(s instanceof Set)) db.set(a[0], (s = new Set()));
      let n = 0;
      for (const v of a.slice(1)) if (!s.has(String(v))) { s.add(String(v)); n++; }
      return n;
    }
    case "SMEMBERS": {
      const s = live(a[0]);
      return s instanceof Set ? [...s] : [];
    }
    case "SISMEMBER": {
      const s = live(a[0]);
      return s instanceof Set && s.has(String(a[1])) ? 1 : 0;
    }
    default:
      throw new Error("memkv: unsupported command " + name);
  }
}

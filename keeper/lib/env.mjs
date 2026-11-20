// Minimal .env loader for CLI runs (no dependency). Inside Next/Vercel the platform provides env.
import fs from "node:fs";
import path from "node:path";

export function loadEnv(files = [".env.local", ".env"]) {
  if (process.env.NEXT_RUNTIME || process.env.VERCEL) return;
  for (const f of files) {
    const file = path.resolve(process.cwd(), f);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}

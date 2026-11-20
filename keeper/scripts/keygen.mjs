// Generate Candyfun's keys once, into keys/ (gitignored). Never overwrites an existing file.
//   platform-admin  owns the LaunchLab platform config (its PDA is derived from this key)
//   fee-wallet      claims the 0.1% and sends the weekly airdrop; holds only the trader pot
//   irys            pays for metadata uploads to Arweave (a few cents of SOL)
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), "keys");
fs.mkdirSync(dir, { recursive: true });

for (const name of ["platform-admin", "fee-wallet", "irys"]) {
  const file = path.join(dir, `${name}.json`);
  if (fs.existsSync(file)) {
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
    console.log(name.padEnd(15), kp.publicKey.toBase58(), "(exists)");
    continue;
  }
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  fs.writeFileSync(path.join(dir, `${name}.base58.txt`), bs58.encode(kp.secretKey));
  console.log(name.padEnd(15), kp.publicKey.toBase58(), "(new)");
}

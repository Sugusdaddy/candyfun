// Permanent metadata storage on Arweave through Irys. Uploads are paid by a small server key
// (IRYS_KEY) that holds nothing else; launches are rate limited per IP and per wallet.
export function parseDataUri(raw: string): { buf: Buffer; contentType: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(raw);
  if (m) return { contentType: m[1], buf: Buffer.from(m[2], "base64") };
  return { contentType: "image/png", buf: Buffer.from(raw, "base64") };
}

export async function getIrys() {
  const { Uploader } = await import("@irys/upload");
  const { Solana } = await import("@irys/upload-solana");
  const key = process.env.IRYS_KEY;
  if (!key) throw new Error("IRYS_KEY not configured");
  const rpc = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  return Uploader(Solana).withWallet(key.trim()).withRpc(rpc).mainnet();
}

export async function uploadBytes(irys: any, data: Buffer, contentType: string): Promise<string> {
  const price = await irys.getPrice(data.length);
  const balance = await irys.getBalance();
  if (balance.lt(price)) await irys.fund(price.minus(balance).multipliedBy(1.5).integerValue(0));
  const receipt = await irys.upload(data, { tags: [{ name: "Content-Type", value: contentType }] });
  return `https://gateway.irys.xyz/${receipt.id}`;
}

/** Uploads the image and a Metaplex-style metadata JSON; returns { imageUri, metadataUri }. */
export async function uploadTokenMetadata(input: { name: string; symbol: string; description: string; logoDataUri: string; website?: string; twitter?: string; telegram?: string }) {
  const { buf, contentType } = parseDataUri(input.logoDataUri);
  if (!buf.length) throw new Error("invalid image");
  if (buf.length > 1_500_000) throw new Error("image too large");
  const irys = await getIrys();
  const imageUri = await uploadBytes(irys, buf, contentType);
  const metadata = {
    name: input.name.slice(0, 32),
    symbol: input.symbol.slice(0, 10),
    description: input.description.slice(0, 500),
    image: imageUri,
    ...(input.website ? { website: input.website } : {}),
    ...(input.twitter ? { twitter: input.twitter } : {}),
    ...(input.telegram ? { telegram: input.telegram } : {}),
    createdOn: process.env.NEXT_PUBLIC_SITE_URL || "https://candyfun.example",
  };
  const metadataUri = await uploadBytes(irys, Buffer.from(JSON.stringify(metadata)), "application/json");
  return { imageUri, metadataUri };
}

/** Upload one image (data URI) and return its permanent URL. */
export async function uploadImage(dataUri: string): Promise<string> {
  const { buf, contentType } = parseDataUri(dataUri);
  if (!buf.length) throw new Error("invalid image");
  return uploadBytes(await getIrys(), buf, contentType);
}

/** Local runs without a funded uploader key: skip Arweave and keep the image inline. */
export const FAKE_UPLOADS = process.env.FAKE_UPLOADS === "1";

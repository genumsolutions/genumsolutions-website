// =====================================================================
// generate-vapid-keys.mjs — one-time (and rotate-on-demand) generator for
// the website's Web Push VAPID keys (W-3). NO Firebase involved.
//
// Writes NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY into .env.local
// (gitignored). The PRIVATE key is never printed to the console; the
// public key is safe to print (browsers receive it by design).
//
// Run:  node scripts/generate-vapid-keys.mjs
//
// After generating locally:
//   1. Restart `npm run dev` so Next.js picks the new env vars up.
//   2. Mirror both keys in the Vercel dashboard (Production env) —
//      the push API routes need them at runtime.
//   3. Mirror both keys on the push-order-status edge function secrets —
//      it signs the outgoing pushes with the same identity.
// =====================================================================

import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");

// P-256 keypair — the curve the Web Push protocol mandates.
const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const publicKeyRaw = publicKey.export({ type: "spki", format: "der" }).subarray(-65);
// FULL PKCS8 DER — WebCrypto's importKey('pkcs8', …) needs the complete
// structure, not just the 32-byte private integer.
const privateKeyRaw = privateKey.export({ type: "pkcs8", format: "der" });

const publicKeyB64 = b64url(publicKeyRaw);
const privateKeyB64 = b64url(privateKeyRaw);

const envPath = resolve(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error("✗ .env.local not found — run this from the website repo root.");
  process.exit(1);
}

const existing = readFileSync(envPath, "utf8");
const lines = existing.split(/\r?\n/);
function upsert(key, value) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  const entry = `${key}=${value}`;
  if (index >= 0) lines[index] = entry;
  else lines.push(entry);
}
upsert("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKeyB64);
upsert("VAPID_PRIVATE_KEY", privateKeyB64);
writeFileSync(envPath, lines.join("\n"), "utf8");

console.log("✓ VAPID keys generated and written to .env.local");
console.log(`  Public key (safe to share): ${publicKeyB64}`);
console.log("  Private key: (hidden — read .env.local if you really need it)");
console.log("");
console.log("Next steps:");
console.log("  1. Restart the dev server / redeploy so the env vars load.");
console.log("  2. Mirror BOTH keys in Vercel (Production env) and in the");
console.log("     push-order-status edge function secrets.");

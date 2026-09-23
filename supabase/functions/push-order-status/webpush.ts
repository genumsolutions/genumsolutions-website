// =====================================================================
// webpush.ts — standards-based Web Push for Supabase Edge Functions
// (Deno), NO Firebase.
//
// Implements exactly two RFCs using only WebCrypto built-ins:
//   • RFC 8291 + RFC 8188 — aes128gcm message encryption
//   • RFC 8292 — VAPID authentication (ES256 JWT)
//
// crypto.subtle.sign('ECDSA', …) already returns the raw 64-byte r||s
// form JWS/ES256 requires (NO DER conversion — that trap breaks ports
// from Node's jsonwebtoken). The aes128gcm branch is the modern RFC
// 8291 two-stage HKDF: Extract(auth, ecdh) → Expand("WebPush: info")
// → Extract(random salt) → CEK/nonce; the record seals plaintext ||
// 0x02 with NO additional data.
//
// Key material (base64url):
//   publicKey  — the raw 65-byte uncompressed P-256 point (0x04 || X || Y);
//                generate-vapid-keys.mjs writes exactly this form.
//   privateKey — the FULL PKCS8 DER; imported with WebCrypto directly.
//
// This file must stay dependency-free so it never needs a bundle step.
// =====================================================================

// ---------- base64url helpers ----------

function b64urlToBytes(input: string): Uint8Array {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ---------- HKDF via WebCrypto ----------
// WebCrypto exposes HKDF only as the FUSED Extract-then-Expand. RFC 8291's
// four-step chain maps exactly onto two fused calls:
//   call 1: HKDF(salt=auth_secret, IKM=ecdh_secret, info=key_info, 32)
//             = steps 1+2 (PRK_key extract + IKM expand) fused.
//   call 2: HKDF(salt=random 16-byte salt, IKM=IKM, info=cek/nonce_info, L)
//             = steps 3+4 (PRK extract + CEK/nonce expand) fused.
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  lengthBytes: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

// ---------- RFC 8291 + RFC 8188 — aes128gcm encryption ----------

const RS = 4096; // record size (safe default; single record for small payloads)

export async function encryptPayload(
  userPublicKeyB64: string,
  userAuthB64: string,
  plaintext: string
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(userPublicKeyB64);
  const uaAuth = b64urlToBytes(userAuthB64);

  // 1) Ephemeral ECDH keypair on P-256 (fresh per message).
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const ephemeralPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey)
  );

  // 2) ecdh_secret = ECDH(ephemeral_priv, user_public).
  const userKey = await crypto.subtle.importKey(
    "raw",
    uaPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: userKey }, ephemeral.privateKey, 256)
  );

  // 3) IKM = HKDF(salt=auth_secret, IKM=ecdh_secret,
  //      info="WebPush: info" || 0x00 || ua_public || as_public, 32)
  //    (RFC 8291 steps 1+2 fused into one WebCrypto call)
  const ikm = await hkdf(
    uaAuth,
    ecdhSecret,
    concatBytes(
      new TextEncoder().encode("WebPush: info"),
      new Uint8Array([0x00]),
      uaPublic,
      ephemeralPublicRaw
    ),
    32
  );

  // 4) Fresh random 16-byte salt per message — heads the record on the wire
  //    and re-extracts the IKM (RFC 8291 steps 3+4 fused below).
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5) CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm" || 0x00, 16)
  //    NONCE = HKDF(salt, IKM, "Content-Encoding: nonce" || 0x00, 12)
  const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  // 6) Record = plaintext || 0x02 (padding delimiter, no extra padding),
  //    sealed with AES-128-GCM and NO additional data (RFC 8188 §2).
  const payloadBytes = new TextEncoder().encode(plaintext);
  const record = concatBytes(payloadBytes, new Uint8Array([0x02]));
  const key = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "encrypt",
  ]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
      key,
      record as BufferSource
    )
  );

  // 7) aes128gcm body (RFC 8188 §2): salt(16) || record-size(4) ||
  //    key-id length(1) || key-id (our ephemeral public key) || sealed.
  const header = concatBytes(
    salt,
    new Uint8Array([0x00, 0x00, (RS >> 8) & 0xff, RS & 0xff]),
    new Uint8Array([ephemeralPublicRaw.length]),
    ephemeralPublicRaw
  );
  return concatBytes(header, sealed);
}

// ---------- RFC 8292 — VAPID (ES256 JWT) ----------

// NOTE: crypto.subtle.sign('ECDSA', …) already returns the raw 64-byte
// r||s signature JWS requires. No DER unwrapping — that would CORRUPT
// the signature (the classic Node-jsonwebtoken porting trap).

export async function createVapidAuthorization(
  endpoint: string,
  publicKeyB64: string,
  privateKeyB64: string
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 h (max 24 h allowed)
    sub: "mailto:genumsolutions@gmail.com",
  };
  const header = { typ: "JWT", alg: "ES256" };
  const unsigned = `${bytesToB64url(new TextEncoder().encode(JSON.stringify(header)))}.${bytesToB64url(new TextEncoder().encode(JSON.stringify(claims)))}`;

  const privateKeyDer = b64urlToBytes(privateKeyB64);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDer as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(unsigned) as BufferSource
    )
  );
  if (signature.length !== 64)
    throw new Error(`Unexpected ECDSA signature length: ${signature.length}`);
  return `vapid t=${unsigned}.${bytesToB64url(signature)}, k=${publicKeyB64}`;
}

// ---------- Public API ----------

export type WebPushResult = "sent" | "gone" | "error";

export async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<WebPushResult> {
  try {
    const encrypted = await encryptPayload(p256dh, auth, JSON.stringify(payload));
    const authorization = await createVapidAuthorization(endpoint, vapidPublicKey, vapidPrivateKey);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "normal",
      },
      body: encrypted as BufferSource,
    });
    // 404/410 = subscription expired or revoked → caller should prune it.
    if (response.status === 404 || response.status === 410) return "gone";
    return response.ok ? "sent" : "error";
  } catch {
    return "error";
  }
}

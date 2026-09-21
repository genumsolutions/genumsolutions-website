import { describe, expect, it } from 'vitest'
import { encryptPayload, createVapidAuthorization } from '../supabase/functions/push-order-status/webpush'

// =====================================================================
// Real-crypto roundtrip for the W-3 push core (Node 20+ ships WebCrypto).
//
// The browser service worker decrypts with ITS OWN subscription private
// key, so the faithful test is: encrypt with the subscription keys the
// way the edge function does, then decrypt with the subscription's
// private half recreated here — proving the RFC 8291 construction (the
// fused HKDF chain, CEK/nonce derivation, record framing) is
// byte-correct. The VAPID half is verified as an ES256 JWT signature
// over the exact signing input, using WebCrypto's own verifier.
// =====================================================================

function b64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    lengthBytes * 8,
  )
  return new Uint8Array(bits)
}

async function generateSubscriptionKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return {
    publicB64: bytesToB64url(publicRaw),
    publicRaw,
    privatePkcs8,
    authB64: bytesToB64url(auth),
  }
}

// Decrypt an aes128gcm body with the subscription private key (the inverse
// of RFC 8291 §4 — exactly what the browser does with its stored keys).
async function decryptAes128gcm(
  body: Uint8Array,
  privatePkcs8: Uint8Array,
  subscriptionAuthB64: string,
  subscriptionPublicRaw: Uint8Array,
): Promise<string> {
  // Header: salt(16) || rs(4) || key-id length(1) || key-id (ephemeral public).
  const salt = body.slice(0, 16)
  const keyIdLength = body[20]
  if (keyIdLength === undefined) throw new Error('Empty aes128gcm body')
  const ephemeralStart = 21
  const ephemeral = body.slice(ephemeralStart, ephemeralStart + keyIdLength)
  const ciphertext = body.slice(ephemeralStart + keyIdLength)

  const privateKey = await crypto.subtle.importKey('pkcs8', privatePkcs8 as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const ephemeralKey = await crypto.subtle.importKey('raw', ephemeral as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeralKey }, privateKey, 256))

  // Mirror of the sender's HKDF chain, from the receiver's side:
  //   IKM  = HKDF(auth, ecdh_secret, "WebPush: info" || 0x00 || ua_pub || as_pub, 32)
  //   (ua_pub = the SUBSCRIBER's public key first, as_pub = the server's
  //    ephemeral second — per RFC 8291 §4)
  //   CEK  = HKDF(salt, IKM, "Content-Encoding: aes128gcm" || 0x00, 16)
  //   NONCE = HKDF(salt, IKM, "Content-Encoding: nonce" || 0x00, 12)
  const ikm = await hkdf(
    b64urlToBytes(subscriptionAuthB64),
    ecdhSecret,
    concat(new TextEncoder().encode('WebPush: info'), new Uint8Array([0x00]), subscriptionPublicRaw, ephemeral),
    32,
  )
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12)

  const key = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['decrypt'])
  const block = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 }, key, ciphertext as BufferSource),
  )

  // Trailing padding delimiter: the record ends with 0x02 (no extra padding).
  expect(block[block.length - 1]).toBe(0x02)
  return new TextDecoder().decode(block.slice(0, block.length - 1))
}

describe('webpush crypto core (W-3, no Firebase)', () => {
  it('encrypts a payload the subscription private key can decrypt (RFC 8291 roundtrip)', async () => {
    const subscription = await generateSubscriptionKeys()
    const encrypted = await encryptPayload(subscription.publicB64, subscription.authB64, '{"title":"Order paid","body":"See you soon","url":"/account"}')
    const plaintext = await decryptAes128gcm(encrypted, subscription.privatePkcs8, subscription.authB64, subscription.publicRaw)
    expect(JSON.parse(plaintext)).toEqual({ title: 'Order paid', body: 'See you soon', url: '/account' })
  })

  it('produces a different ciphertext each time (fresh ephemeral key + salt)', async () => {
    const subscription = await generateSubscriptionKeys()
    const a = await encryptPayload(subscription.publicB64, subscription.authB64, 'same message')
    const b = await encryptPayload(subscription.publicB64, subscription.authB64, 'same message')
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it('uses a fresh random wire salt per message', async () => {
    const subscription = await generateSubscriptionKeys()
    const a = await encryptPayload(subscription.publicB64, subscription.authB64, 'x')
    const b = await encryptPayload(subscription.publicB64, subscription.authB64, 'x')
    expect(Buffer.from(a.slice(0, 16)).equals(Buffer.from(b.slice(0, 16)))).toBe(false)
  })

  it('frames the body as salt(16) + rs(4) = 4096 + key-id(65-byte P-256 point)', async () => {
    const subscription = await generateSubscriptionKeys()
    const encrypted = await encryptPayload(subscription.publicB64, subscription.authB64, 'x')
    expect(encrypted[20]).toBe(65) // key-id length = uncompressed P-256 point
    const rs = (encrypted[16]! << 24) | (encrypted[17]! << 16) | (encrypted[18]! << 8) | encrypted[19]!
    expect(rs).toBe(4096)
    expect(encrypted[21]).toBe(0x04) // uncompressed point marker
  })

  it('builds a VAPID Authorization header whose JWT verifies against the public key (RFC 8292)', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))

    const authorization = await createVapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/abc123',
      bytesToB64url(publicRaw),
      bytesToB64url(privatePkcs8),
    )
    expect(authorization).toMatch(/^vapid t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+), k=[A-Za-z0-9_-]+$/)

    const token = authorization.slice('vapid t='.length, authorization.indexOf(','))
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !signatureB64) throw new Error('Malformed VAPID token')
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)))
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)))
    expect(header).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toContain('mailto:')

    // ES256 JWS signatures are the raw 64-byte r||s form — verify the exact
    // bytes with WebCrypto's own verifier (no DER anywhere in the path).
    const rawSignature = b64urlToBytes(signatureB64)
    expect(rawSignature).toHaveLength(64)
    const key = await crypto.subtle.importKey('raw', publicRaw as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      rawSignature as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`) as BufferSource,
    )
    expect(verified).toBe(true)
  })
})

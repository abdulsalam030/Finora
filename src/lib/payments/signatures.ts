import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Paystack: `x-paystack-signature` = hex HMAC-SHA512 of the raw body, keyed with the secret key. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

/**
 * Flutterwave: newer webhooks send `flutterwave-signature` = base64 HMAC-SHA256 of the raw body keyed
 * with the secret hash; older ones send `verif-hash` equal to the secret hash itself. Accept either.
 */
export function verifyFlutterwaveSignature(rawBody: string, headers: Headers, secretHash: string) {
  const signature = headers.get("flutterwave-signature");
  if (signature) {
    const expected = createHmac("sha256", secretHash).update(rawBody).digest("base64");
    return safeEqual(expected, signature);
  }
  const verifHash = headers.get("verif-hash");
  return verifHash !== null && safeEqual(verifHash, secretHash);
}

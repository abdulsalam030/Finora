import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const newToken = () => randomBytes(32).toString("base64url");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Keyed hash for short secrets (OTP codes) so a DB leak alone can't brute-force them offline. */
export function hmac(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const sixDigitCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

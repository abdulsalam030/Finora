export type Currency = "NGN" | "USD";

const MINOR_UNITS: Record<Currency, number> = { NGN: 100, USD: 100 };

/** Parse a user-entered major-unit string ("1,250.50") to integer minor units, without floats. */
export function toMinor(input: string, currency: Currency): bigint {
  const clean = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw new Error("Invalid amount");
  const [whole, frac = ""] = clean.split(".");
  const scale = MINOR_UNITS[currency];
  return BigInt(whole) * BigInt(scale) + BigInt(frac.padEnd(2, "0"));
}

export function formatMoney(minor: bigint | number | string, currency: Currency): string {
  const value = BigInt(minor);
  const scale = BigInt(MINOR_UNITS[currency]);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / scale).toLocaleString("en-US");
  const frac = (abs % scale).toString().padStart(2, "0");
  const symbol = currency === "NGN" ? "₦" : "$";
  return `${negative ? "-" : ""}${symbol}${whole}.${frac}`;
}

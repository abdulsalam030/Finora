import type { Currency } from "@/lib/money";
import { verifyFlutterwaveSignature } from "./signatures";
import { GatewayError, type PaymentProvider } from "./types";

const BASE = "https://api.flutterwave.com/v3";

function env(name: "FLUTTERWAVE_SECRET_KEY" | "FLUTTERWAVE_WEBHOOK_HASH") {
  const value = process.env[name];
  if (!value) throw new GatewayError("FLUTTERWAVE", `${name} is not set`);
  return value;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env("FLUTTERWAVE_SECRET_KEY")}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== "success") {
    throw new GatewayError("FLUTTERWAVE", body.message ?? `HTTP ${res.status}`, res.status);
  }
  return body.data as T;
}

// Flutterwave speaks major units. Convert at the boundary only, via strings, never float maths on our side.
export function minorToMajorString(minor: bigint): string {
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}
export function majorToMinor(major: number | string): bigint {
  const [whole, frac = ""] = String(major).split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

export const flutterwave: PaymentProvider = {
  name: "FLUTTERWAVE",
  currencies: ["NGN", "USD"] as const satisfies readonly Currency[],

  async initialize({ reference, amountMinor, currency, email, name, callbackUrl }) {
    const data = await call<{ link: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: reference,
        amount: minorToMajorString(amountMinor),
        currency,
        redirect_url: callbackUrl,
        customer: { email, name },
        customizations: { title: "Pulse Wallet", description: "Wallet funding" },
      }),
    });
    return { checkoutUrl: data.link };
  },

  async verify(reference) {
    let data: { status: string; amount: number; currency: string; id: number; processor_response?: string };
    try {
      data = await call(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
    } catch (err) {
      // No charge attempt exists yet for this reference.
      if (err instanceof GatewayError && (err.status === 400 || err.status === 404)) return { status: "pending" };
      throw err;
    }
    if (data.status === "successful") {
      return { status: "success", amountMinor: majorToMinor(data.amount), currency: data.currency, providerTxId: String(data.id) };
    }
    if (data.status === "failed") return { status: "failed", reason: data.processor_response ?? "failed" };
    return { status: "pending" };
  },

  parseWebhook(rawBody, headers) {
    if (!verifyFlutterwaveSignature(rawBody, headers, env("FLUTTERWAVE_WEBHOOK_HASH"))) return null;
    const event = JSON.parse(rawBody) as { event?: string; type?: string; data?: { id?: number; tx_ref?: string } };
    const type = event.event ?? event.type ?? "";
    if (!type.startsWith("charge.") || !event.data?.tx_ref) return null;
    return { eventId: `${type}:${event.data.id}`, reference: event.data.tx_ref, type };
  },
};

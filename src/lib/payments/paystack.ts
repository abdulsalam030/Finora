import type { Currency } from "@/lib/money";
import { verifyPaystackSignature } from "./signatures";
import { GatewayError, type PaymentProvider } from "./types";

const BASE = "https://api.paystack.co";

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new GatewayError("PAYSTACK", "PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    throw new GatewayError("PAYSTACK", body.message ?? `HTTP ${res.status}`, res.status);
  }
  return body.data as T;
}

export const paystack: PaymentProvider = {
  name: "PAYSTACK",
  // Paystack amounts are already in minor units (kobo). USD needs enabling per business, so NGN only.
  currencies: ["NGN"] as const satisfies readonly Currency[],

  async initialize({ reference, amountMinor, currency, email, callbackUrl }) {
    const data = await call<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ email, amount: amountMinor.toString(), currency, reference, callback_url: callbackUrl }),
    });
    return { checkoutUrl: data.authorization_url };
  },

  async verify(reference) {
    let data: { status: string; amount: number; currency: string; id: number; gateway_response?: string };
    try {
      data = await call(`/transaction/verify/${encodeURIComponent(reference)}`);
    } catch (err) {
      // Paystack 400s a verify for a checkout that was opened but never paid.
      if (err instanceof GatewayError && err.status === 400) return { status: "pending" };
      throw err;
    }
    if (data.status === "success") {
      return { status: "success", amountMinor: BigInt(data.amount), currency: data.currency, providerTxId: String(data.id) };
    }
    if (data.status === "failed" || data.status === "reversed") {
      return { status: "failed", reason: data.gateway_response ?? data.status };
    }
    return { status: "pending" }; // ongoing, abandoned, pending, queued
  },

  parseWebhook(rawBody, headers) {
    if (!verifyPaystackSignature(rawBody, headers.get("x-paystack-signature"), secret())) return null;
    const event = JSON.parse(rawBody) as { event: string; data?: { id?: number; reference?: string } };
    if (!event.event.startsWith("charge.") || !event.data?.reference) return null;
    return { eventId: `${event.event}:${event.data.id}`, reference: event.data.reference, type: event.event };
  },
};

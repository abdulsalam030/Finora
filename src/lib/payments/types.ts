import type { Currency } from "@/lib/money";

export type ProviderName = "PAYSTACK" | "FLUTTERWAVE";

export type InitializeInput = {
  reference: string;
  amountMinor: bigint;
  currency: Currency;
  email: string;
  name: string;
  callbackUrl: string;
};

/** What the gateway's own verify API says happened — the only thing we credit on. */
export type VerifiedPayment =
  | { status: "success"; amountMinor: bigint; currency: string; providerTxId: string }
  | { status: "failed"; reason: string }
  | { status: "pending" };

/** A webhook whose signature checked out. We still re-verify via the API before crediting. */
export type WebhookEvent = { eventId: string; reference: string; type: string };

export interface PaymentProvider {
  name: ProviderName;
  currencies: readonly Currency[];
  initialize(input: InitializeInput): Promise<{ checkoutUrl: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
  /** Returns null when the signature is invalid or the event isn't one we act on. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null;
}

export class GatewayError extends Error {
  constructor(provider: ProviderName, message: string, public status?: number) {
    super(`${provider}: ${message}`);
    this.name = "GatewayError";
  }
}

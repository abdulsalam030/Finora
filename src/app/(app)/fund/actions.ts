"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { FUNDING_LIMITS, startFunding } from "@/lib/funding";
import { formatMoney, toMinor } from "@/lib/money";
import { getProvider, GatewayError } from "@/lib/payments";
import { echo, fieldErrors, type FormState } from "@/lib/validation";

const schema = z.object({
  amount: z.string().trim().min(1, "Enter an amount"),
  currency: z.enum(["NGN", "USD"]),
  provider: z.enum(["PAYSTACK", "FLUTTERWAVE"]),
});

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function startFundingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = echo(form, ["amount", "currency", "provider"]);
  const user = await requireUser();

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ...fieldErrors(parsed.error), values };
  const { currency, provider } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(parsed.data.amount, currency);
  } catch {
    return { fieldErrors: { amount: ["Enter a valid amount, e.g. 5000 or 5000.50"] }, values };
  }
  const { min, max } = FUNDING_LIMITS[currency];
  if (amountMinor < min || amountMinor > max) {
    return { fieldErrors: { amount: [`Between ${formatMoney(min, currency)} and ${formatMoney(max, currency)}`] }, values };
  }
  if (!getProvider(provider).currencies.includes(currency)) {
    return { fieldErrors: { provider: [`${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"} can't take ${currency} here`] }, values };
  }

  const origin = await baseUrl();
  let checkoutUrl: string;
  try {
    ({ checkoutUrl } = await startFunding({
      user,
      amountMinor,
      currency,
      provider,
      callbackUrl: (ref) => `${origin}/fund/callback/${ref}`,
    }));
  } catch (err) {
    console.error("[fund] checkout init failed", err);
    const detail = err instanceof GatewayError ? ` (${err.message})` : "";
    return { error: `We couldn't open checkout. Please try again.${detail}`, values };
  }
  redirect(checkoutUrl);
}

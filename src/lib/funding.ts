import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createPending, markFailed, post } from "@/lib/ledger";
import { formatMoney, type Currency } from "@/lib/money";
import { getProvider as defaultGetProvider, type PaymentProvider, type ProviderName } from "@/lib/payments";

export const FUNDING_LIMITS: Record<Currency, { min: bigint; max: bigint }> = {
  NGN: { min: 100_00n, max: 1_000_000_00n },
  USD: { min: 1_00n, max: 5_000_00n },
};

export const newReference = () => `PW-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`.toUpperCase();

type StartInput = {
  user: { id: string; email: string; name: string };
  amountMinor: bigint;
  currency: Currency;
  provider: ProviderName;
  callbackUrl: (reference: string) => string;
};

/** Record a PENDING funding and open a checkout with the gateway. */
export async function startFunding({ user, amountMinor, currency, provider, callbackUrl }: StartInput) {
  const gateway = defaultGetProvider(provider);
  if (!gateway.currencies.includes(currency)) throw new Error(`${provider} does not support ${currency} funding`);

  const wallet = await db.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: user.id, currency } } });
  const reference = newReference();
  await createPending({
    reference,
    type: "FUNDING",
    provider,
    userId: user.id,
    currency,
    amount: amountMinor,
    description: `Wallet funding · ${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"}`,
    meta: { walletId: wallet.id },
  });

  try {
    const { checkoutUrl } = await gateway.initialize({
      reference,
      amountMinor,
      currency,
      email: user.email,
      name: user.name,
      callbackUrl: callbackUrl(reference),
    });
    return { reference, checkoutUrl };
  } catch (err) {
    await markFailed(reference, "Could not start checkout");
    throw err;
  }
}

/**
 * Bring a funding transaction to its final state using the gateway's verify API as the source of truth.
 * Safe to call any number of times, from the callback page and from webhooks concurrently.
 */
export async function settleFunding(reference: string, getProvider: (name: ProviderName) => PaymentProvider = defaultGetProvider) {
  const tx = await db.transaction.findUnique({ where: { reference } });
  if (!tx || tx.type !== "FUNDING") return null;
  if (tx.status !== "PENDING" || tx.provider === "INTERNAL") return tx;

  const result = await getProvider(tx.provider).verify(reference);

  if (result.status === "pending") return tx;

  if (result.status === "failed") {
    await markFailed(reference, `Payment failed: ${result.reason}`);
    return db.transaction.findUnique({ where: { reference } });
  }

  // Credit exactly what we asked for, and only if that's exactly what the gateway collected.
  if (result.currency !== tx.currency || result.amountMinor !== tx.amount) {
    await markFailed(
      reference,
      `Amount mismatch: expected ${formatMoney(tx.amount, tx.currency)}, gateway reported ${result.amountMinor} ${result.currency}`,
    );
    return db.transaction.findUnique({ where: { reference } });
  }

  const walletId = (tx.meta as { walletId: string }).walletId;
  const { transaction } = await post({
    reference,
    type: "FUNDING",
    provider: tx.provider,
    userId: tx.userId,
    currency: tx.currency,
    amount: tx.amount,
    description: tx.description ?? undefined,
    meta: { walletId, providerTxId: result.providerTxId },
    entries: [
      { account: { system: "GATEWAY_CLEARING" }, direction: "DEBIT", amount: tx.amount },
      { account: { walletId }, direction: "CREDIT", amount: tx.amount },
    ],
  });
  return transaction;
}

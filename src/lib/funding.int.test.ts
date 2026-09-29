import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { settleFunding } from "@/lib/funding";
import { createPending, reconcileWallet } from "@/lib/ledger";
import type { PaymentProvider, VerifiedPayment } from "@/lib/payments";

// settleFunding against the real DB with a scripted gateway, so outcomes are deterministic.
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];

function fakeGateway(result: VerifiedPayment) {
  let calls = 0;
  const provider = {
    name: "PAYSTACK",
    currencies: ["NGN"],
    initialize: async () => ({ checkoutUrl: "" }),
    verify: async () => {
      calls++;
      return result;
    },
    parseWebhook: () => null,
  } satisfies PaymentProvider;
  return { get: () => provider, calls: () => calls };
}

async function pendingFunding(label: string, amount: bigint) {
  const user = await db.user.create({
    data: {
      email: `fund-${run}-${label}@test.local`,
      username: `fund_${run}_${label}`,
      name: "Funding Test",
      passwordHash: "x",
      wallets: { create: { currency: "NGN" } },
    },
    include: { wallets: true },
  });
  userIds.push(user.id);
  const reference = `PW-TEST-${randomUUID()}`;
  await createPending({
    reference,
    type: "FUNDING",
    provider: "PAYSTACK",
    userId: user.id,
    currency: "NGN",
    amount,
    meta: { walletId: user.wallets[0].id },
  });
  return { reference, walletId: user.wallets[0].id };
}

const balance = async (id: string) => (await db.wallet.findUniqueOrThrow({ where: { id } })).cachedBalance;

afterAll(async () => {
  const txs = await db.transaction.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  await db.ledgerEntry.deleteMany({ where: { transactionId: { in: txs.map((t) => t.id) } } });
  await db.transaction.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("settleFunding (integration)", () => {
  it("credits once when callback and webhooks settle concurrently", async () => {
    const { reference, walletId } = await pendingFunding("ok", 250_000n);
    const gw = fakeGateway({ status: "success", amountMinor: 250_000n, currency: "NGN", providerTxId: "42" });

    await Promise.all([settleFunding(reference, gw.get), settleFunding(reference, gw.get), settleFunding(reference, gw.get)]);

    expect(await balance(walletId)).toBe(250_000n);
    expect((await db.transaction.findUniqueOrThrow({ where: { reference } })).status).toBe("SUCCESS");
    expect((await reconcileWallet(walletId)).ok).toBe(true);

    // Once settled, we don't even call the gateway again.
    const before = gw.calls();
    await settleFunding(reference, gw.get);
    expect(gw.calls()).toBe(before);
  });

  it("fails the transaction and credits nothing when the gateway collected a different amount", async () => {
    const { reference, walletId } = await pendingFunding("short", 500_000n);
    const gw = fakeGateway({ status: "success", amountMinor: 100n, currency: "NGN", providerTxId: "43" });
    const tx = await settleFunding(reference, gw.get);
    expect(tx?.status).toBe("FAILED");
    expect(tx?.description).toMatch(/Amount mismatch/);
    expect(await balance(walletId)).toBe(0n);
  });

  it("fails on a currency mismatch", async () => {
    const { reference, walletId } = await pendingFunding("fx", 500_000n);
    const gw = fakeGateway({ status: "success", amountMinor: 500_000n, currency: "USD", providerTxId: "44" });
    expect((await settleFunding(reference, gw.get))?.status).toBe("FAILED");
    expect(await balance(walletId)).toBe(0n);
  });

  it("marks a declined payment FAILED", async () => {
    const { reference, walletId } = await pendingFunding("declined", 500_000n);
    const tx = await settleFunding(reference, fakeGateway({ status: "failed", reason: "Declined" }).get);
    expect(tx?.status).toBe("FAILED");
    expect(await balance(walletId)).toBe(0n);
  });

  it("leaves an unpaid checkout PENDING", async () => {
    const { reference } = await pendingFunding("pending", 500_000n);
    const tx = await settleFunding(reference, fakeGateway({ status: "pending" }).get);
    expect(tx?.status).toBe("PENDING");
  });

  it("ignores unknown references", async () => {
    expect(await settleFunding("PW-DOES-NOT-EXIST", fakeGateway({ status: "pending" }).get)).toBeNull();
  });
});

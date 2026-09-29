import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPending, LedgerError, post, reconcileWallet } from "./index";

// Runs against the real database. Every row created here is tied to a test user and removed afterwards.
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];

async function makeUserWithWallet(label: string) {
  const user = await db.user.create({
    data: {
      email: `ledger-${run}-${label}@test.local`,
      username: `ledger_${run}_${label}`,
      name: `Test ${label}`,
      passwordHash: "x",
      wallets: { create: { currency: "NGN" } },
    },
    include: { wallets: true },
  });
  userIds.push(user.id);
  return { user, wallet: user.wallets[0] };
}

function fund(userId: string, walletId: string, amount: bigint, reference = `fund-${randomUUID()}`) {
  return post({
    reference,
    type: "FUNDING",
    provider: "PAYSTACK",
    userId,
    currency: "NGN",
    amount,
    entries: [
      { account: { system: "GATEWAY_CLEARING" }, direction: "DEBIT", amount },
      { account: { walletId }, direction: "CREDIT", amount },
    ],
  });
}

function transfer(userId: string, from: string, to: string, amount: bigint, reference = `tr-${randomUUID()}`) {
  return post({
    reference,
    type: "TRANSFER",
    provider: "INTERNAL",
    userId,
    currency: "NGN",
    amount,
    entries: [
      { account: { walletId: from }, direction: "DEBIT", amount },
      { account: { walletId: to }, direction: "CREDIT", amount },
    ],
  });
}

async function balance(walletId: string) {
  return (await db.wallet.findUniqueOrThrow({ where: { id: walletId } })).cachedBalance;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set — integration tests need a database");
});

afterAll(async () => {
  const txs = await db.transaction.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const ids = txs.map((t) => t.id);
  await db.ledgerEntry.deleteMany({ where: { transactionId: { in: ids } } });
  await db.transaction.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("ledger (integration)", () => {
  it("completes a pending funding exactly once, even when the webhook is delivered twice", async () => {
    const { user, wallet } = await makeUserWithWallet("fund");
    const reference = `fund-${randomUUID()}`;
    await createPending({ reference, type: "FUNDING", provider: "PAYSTACK", userId: user.id, currency: "NGN", amount: 500_000n });
    expect(await balance(wallet.id)).toBe(0n);

    const results = await Promise.all([
      fund(user.id, wallet.id, 500_000n, reference),
      fund(user.id, wallet.id, 500_000n, reference),
      fund(user.id, wallet.id, 500_000n, reference),
    ]);

    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(await balance(wallet.id)).toBe(500_000n);
    expect(await db.ledgerEntry.count({ where: { walletId: wallet.id } })).toBe(1);
    expect((await reconcileWallet(wallet.id)).ok).toBe(true);
  });

  it("rejects a webhook whose amount differs from the pending transaction", async () => {
    const { user, wallet } = await makeUserWithWallet("tamper");
    const reference = `fund-${randomUUID()}`;
    await createPending({ reference, type: "FUNDING", provider: "PAYSTACK", userId: user.id, currency: "NGN", amount: 1_000n });
    await expect(fund(user.id, wallet.id, 9_999_999n, reference)).rejects.toMatchObject({ code: "MISMATCH" });
    expect(await balance(wallet.id)).toBe(0n);
  });

  it("refuses to overdraw a wallet", async () => {
    const a = await makeUserWithWallet("od-a");
    const b = await makeUserWithWallet("od-b");
    await fund(a.user.id, a.wallet.id, 1_000n);
    await expect(transfer(a.user.id, a.wallet.id, b.wallet.id, 1_001n)).rejects.toBeInstanceOf(LedgerError);
    expect(await balance(a.wallet.id)).toBe(1_000n);
    expect(await balance(b.wallet.id)).toBe(0n);
  });

  it("never overdraws under concurrent transfers", async () => {
    const a = await makeUserWithWallet("cc-a");
    const b = await makeUserWithWallet("cc-b");
    await fund(a.user.id, a.wallet.id, 10_000n);

    // 10 concurrent attempts to send 3,000 from a 10,000 balance: exactly 3 can succeed.
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => transfer(a.user.id, a.wallet.id, b.wallet.id, 3_000n)),
    );

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(3);
    expect(failed.every((f) => f.reason instanceof LedgerError && f.reason.code === "INSUFFICIENT_FUNDS")).toBe(true);
    expect(await balance(a.wallet.id)).toBe(1_000n);
    expect(await balance(b.wallet.id)).toBe(9_000n);
    expect((await reconcileWallet(a.wallet.id)).ok).toBe(true);
    expect((await reconcileWallet(b.wallet.id)).ok).toBe(true);
  });

  it("handles opposite-direction concurrent transfers without deadlocking", async () => {
    const a = await makeUserWithWallet("dl-a");
    const b = await makeUserWithWallet("dl-b");
    await fund(a.user.id, a.wallet.id, 5_000n);
    await fund(b.user.id, b.wallet.id, 5_000n);

    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        i % 2 ? transfer(a.user.id, a.wallet.id, b.wallet.id, 100n) : transfer(b.user.id, b.wallet.id, a.wallet.id, 100n),
      ),
    );

    expect((await balance(a.wallet.id)) + (await balance(b.wallet.id))).toBe(10_000n);
    expect(await balance(a.wallet.id)).toBe(5_000n);
  });
});

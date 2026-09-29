import { Prisma } from "@/generated/prisma/client";
import type { Currency, PaymentProvider, TransactionType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { assertBalanced, LedgerError, signedAmount, type EntryInput } from "./validate";

export { LedgerError } from "./validate";
export type { Account, EntryInput } from "./validate";

export type PostingInput = {
  reference: string;
  type: TransactionType;
  provider: PaymentProvider;
  userId: string;
  currency: Currency;
  /** Headline amount shown to the user (usually the principal moved). */
  amount: bigint;
  description?: string;
  meta?: Prisma.InputJsonValue;
  entries: EntryInput[];
};

type Tx = Prisma.TransactionClient;

/**
 * Create a PENDING transaction with no ledger effect (e.g. a gateway checkout awaiting its webhook).
 * Idempotent on `reference`.
 */
export async function createPending(input: Omit<PostingInput, "entries">) {
  return db.transaction.upsert({
    where: { reference: input.reference },
    create: { ...input, status: "PENDING" },
    update: {},
  });
}

/**
 * Atomically post balanced entries and mark the transaction SUCCESS.
 *
 * - Idempotent: posting a reference that already succeeded returns it unchanged.
 * - Completes an existing PENDING transaction with the same reference (webhook path).
 * - Locks every touched wallet/card row (in id order, to avoid deadlocks) so concurrent
 *   postings can't overdraw a balance.
 */
export async function post(input: PostingInput) {
  assertBalanced(input.entries);

  try {
    return await db.$transaction((tx) => postInTx(tx, input), {
      isolationLevel: "ReadCommitted",
      // Wait for a pooled connection / row lock rather than failing fast under contention.
      maxWait: 10_000,
      timeout: 30_000,
    });
  } catch (err) {
    // Two requests raced to create the same reference: the loser returns the winner's result.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.transaction.findUnique({ where: { reference: input.reference } });
      if (existing?.status === "SUCCESS") return { transaction: existing, duplicate: true };
    }
    throw err;
  }
}

async function postInTx(tx: Tx, input: PostingInput) {
  // Serialise all work on this reference.
  const [existing] = await tx.$queryRaw<{ id: string; status: string; amount: bigint; currency: string }[]>`
    SELECT id, status, amount, currency FROM "Transaction" WHERE reference = ${input.reference} FOR UPDATE`;

  if (existing?.status === "SUCCESS") {
    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: existing.id } });
    return { transaction, duplicate: true };
  }
  if (existing?.status === "FAILED") {
    throw new LedgerError("ALREADY_FAILED", `Transaction ${input.reference} already failed`);
  }
  if (existing && (existing.amount !== input.amount || existing.currency !== input.currency)) {
    throw new LedgerError("MISMATCH", `Amount/currency differs from pending transaction ${input.reference}`);
  }

  // Net change per account.
  const walletDelta = new Map<string, bigint>();
  const cardDelta = new Map<string, bigint>();
  for (const e of input.entries) {
    if ("walletId" in e.account) {
      walletDelta.set(e.account.walletId, (walletDelta.get(e.account.walletId) ?? 0n) + signedAmount(e));
    } else if ("cardId" in e.account) {
      cardDelta.set(e.account.cardId, (cardDelta.get(e.account.cardId) ?? 0n) + signedAmount(e));
    }
  }

  const walletIds = [...walletDelta.keys()].sort();
  const cardIds = [...cardDelta.keys()].sort();

  const wallets = walletIds.length
    ? await tx.$queryRaw<{ id: string; cachedBalance: bigint; currency: string }[]>`
        SELECT id, "cachedBalance", currency FROM "Wallet" WHERE id = ANY(${walletIds}) ORDER BY id FOR UPDATE`
    : [];
  const cards = cardIds.length
    ? await tx.$queryRaw<{ id: string; cachedBalance: bigint; currency: string; status: string; spendLimit: bigint | null }[]>`
        SELECT id, "cachedBalance", currency, status, "spendLimit" FROM "VirtualCard" WHERE id = ANY(${cardIds}) ORDER BY id FOR UPDATE`
    : [];

  if (wallets.length !== walletIds.length || cards.length !== cardIds.length) {
    throw new LedgerError("ACCOUNT_NOT_FOUND", "One or more accounts do not exist");
  }

  for (const acct of [...wallets, ...cards]) {
    if (acct.currency !== input.currency) {
      throw new LedgerError("MISMATCH", `Account ${acct.id} is ${acct.currency}, posting is ${input.currency}`);
    }
  }
  for (const card of cards) {
    const delta = cardDelta.get(card.id)!;
    if (card.status === "FROZEN" && delta < 0n) throw new LedgerError("CARD_FROZEN", "Card is frozen");
  }

  // User balances may never go negative. System accounts are unconstrained.
  for (const w of wallets) {
    if (w.cachedBalance + walletDelta.get(w.id)! < 0n) {
      throw new LedgerError("INSUFFICIENT_FUNDS", "Insufficient wallet balance");
    }
  }
  for (const c of cards) {
    if (c.cachedBalance + cardDelta.get(c.id)! < 0n) {
      throw new LedgerError("INSUFFICIENT_FUNDS", "Insufficient card balance");
    }
  }

  const { entries, ...fields } = input;
  const transaction = existing
    ? await tx.transaction.update({
        where: { id: existing.id },
        data: { status: "SUCCESS", completedAt: new Date(), meta: fields.meta, description: fields.description },
      })
    : await tx.transaction.create({ data: { ...fields, status: "SUCCESS", completedAt: new Date() } });

  await tx.ledgerEntry.createMany({
    data: entries.map((e) => ({
      transactionId: transaction.id,
      direction: e.direction,
      amount: e.amount,
      currency: input.currency,
      walletId: "walletId" in e.account ? e.account.walletId : null,
      cardId: "cardId" in e.account ? e.account.cardId : null,
      systemAccount: "system" in e.account ? e.account.system : null,
    })),
  });

  // One statement per account type, however many accounts the posting touches.
  if (walletDelta.size) {
    await tx.$executeRaw`
      UPDATE "Wallet" AS w SET "cachedBalance" = w."cachedBalance" + d.delta
      FROM unnest(${[...walletDelta.keys()]}::text[], ${[...walletDelta.values()]}::bigint[]) AS d(id, delta)
      WHERE w.id = d.id`;
  }
  if (cardDelta.size) {
    await tx.$executeRaw`
      UPDATE "VirtualCard" AS c SET "cachedBalance" = c."cachedBalance" + d.delta
      FROM unnest(${[...cardDelta.keys()]}::text[], ${[...cardDelta.values()]}::bigint[]) AS d(id, delta)
      WHERE c.id = d.id`;
  }

  return { transaction, duplicate: false };
}

/** Mark a PENDING transaction FAILED (e.g. gateway reported failure). No ledger effect. */
export async function markFailed(reference: string, reason?: string) {
  return db.transaction.updateMany({
    where: { reference, status: "PENDING" },
    data: { status: "FAILED", completedAt: new Date(), description: reason },
  });
}

/** Recompute a wallet balance from its entries — the source of truth — and compare to the cache. */
export async function reconcileWallet(walletId: string) {
  const [row] = await db.$queryRaw<{ ledger: bigint | null; cached: bigint }[]>`
    SELECT
      (SELECT SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END)
         FROM "LedgerEntry" WHERE "walletId" = ${walletId})::bigint AS ledger,
      "cachedBalance" AS cached
    FROM "Wallet" WHERE id = ${walletId}`;
  const ledger = row?.ledger ?? 0n;
  return { ledger, cached: row?.cached ?? 0n, ok: ledger === (row?.cached ?? 0n) };
}

import type { EntryDirection, SystemAccount } from "@/generated/prisma/enums";

export type Account = { walletId: string } | { cardId: string } | { system: SystemAccount };

export type EntryInput = { account: Account; direction: EntryDirection; amount: bigint };

export class LedgerError extends Error {
  constructor(
    public code: "UNBALANCED" | "INVALID_AMOUNT" | "EMPTY" | "INSUFFICIENT_FUNDS" | "ACCOUNT_NOT_FOUND" | "CARD_FROZEN" | "ALREADY_FAILED" | "MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Pure checks every posting must pass before touching the database. */
export function assertBalanced(entries: EntryInput[]): void {
  if (entries.length < 2) throw new LedgerError("EMPTY", "A posting needs at least two entries");
  let debits = 0n;
  let credits = 0n;
  for (const e of entries) {
    if (e.amount <= 0n) throw new LedgerError("INVALID_AMOUNT", "Entry amounts must be positive");
    if (e.direction === "DEBIT") debits += e.amount;
    else credits += e.amount;
  }
  if (debits !== credits) {
    throw new LedgerError("UNBALANCED", `Debits (${debits}) must equal credits (${credits})`);
  }
}

/** Signed effect of an entry on a user-facing balance: credits add, debits subtract. */
export function signedAmount(e: Pick<EntryInput, "direction" | "amount">): bigint {
  return e.direction === "CREDIT" ? e.amount : -e.amount;
}

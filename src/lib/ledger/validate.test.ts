import { describe, expect, it } from "vitest";
import { assertBalanced, LedgerError } from "./validate";

const w = (id: string) => ({ walletId: id });

describe("assertBalanced", () => {
  it("accepts balanced postings", () => {
    expect(() =>
      assertBalanced([
        { account: { system: "GATEWAY_CLEARING" }, direction: "DEBIT", amount: 500n },
        { account: w("a"), direction: "CREDIT", amount: 450n },
        { account: { system: "FEES" }, direction: "CREDIT", amount: 50n },
      ]),
    ).not.toThrow();
  });

  it.each([
    ["unbalanced", [{ account: w("a"), direction: "DEBIT", amount: 10n }, { account: w("b"), direction: "CREDIT", amount: 9n }], "UNBALANCED"],
    ["zero amount", [{ account: w("a"), direction: "DEBIT", amount: 0n }, { account: w("b"), direction: "CREDIT", amount: 0n }], "INVALID_AMOUNT"],
    ["negative amount", [{ account: w("a"), direction: "DEBIT", amount: -5n }, { account: w("b"), direction: "CREDIT", amount: -5n }], "INVALID_AMOUNT"],
    ["single entry", [{ account: w("a"), direction: "DEBIT", amount: 5n }], "EMPTY"],
  ] as const)("rejects %s", (_name, entries, code) => {
    try {
      assertBalanced(entries as never);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LedgerError);
      expect((e as LedgerError).code).toBe(code);
    }
  });
});

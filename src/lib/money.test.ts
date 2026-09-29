import { describe, expect, it } from "vitest";
import { formatMoney, toMinor } from "./money";

describe("toMinor", () => {
  it("parses whole and fractional amounts without float error", () => {
    expect(toMinor("1,250.50", "NGN")).toBe(125050n);
    expect(toMinor("0.1", "USD")).toBe(10n);
    expect(toMinor("19.99", "USD")).toBe(1999n);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "1.234", "-5", "1e3"]) {
      expect(() => toMinor(bad, "NGN")).toThrow();
    }
  });
});

describe("formatMoney", () => {
  it("formats minor units with symbol and grouping", () => {
    expect(formatMoney(4_342_310n, "NGN")).toBe("₦43,423.10");
    expect(formatMoney(-290_000n, "USD")).toBe("-$2,900.00");
    expect(formatMoney(5n, "USD")).toBe("$0.05");
  });
});

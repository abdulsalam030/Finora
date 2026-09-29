import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { majorToMinor, minorToMajorString } from "./flutterwave";
import { verifyFlutterwaveSignature, verifyPaystackSignature } from "./signatures";

const body = JSON.stringify({ event: "charge.success", data: { id: 1, reference: "PW-1" } });

describe("Paystack signature", () => {
  const key = "sk_test_abc";
  const good = createHmac("sha512", key).update(body).digest("hex");

  it("accepts the HMAC-SHA512 of the exact body", () => {
    expect(verifyPaystackSignature(body, good, key)).toBe(true);
  });
  it("rejects a tampered body, wrong key, or missing header", () => {
    expect(verifyPaystackSignature(body.replace("PW-1", "PW-2"), good, key)).toBe(false);
    expect(verifyPaystackSignature(body, good, "sk_test_other")).toBe(false);
    expect(verifyPaystackSignature(body, null, key)).toBe(false);
    expect(verifyPaystackSignature(body, "short", key)).toBe(false);
  });
});

describe("Flutterwave signature", () => {
  const hash = "my-secret-hash";

  it("accepts the newer flutterwave-signature HMAC", () => {
    const sig = createHmac("sha256", hash).update(body).digest("base64");
    expect(verifyFlutterwaveSignature(body, new Headers({ "flutterwave-signature": sig }), hash)).toBe(true);
    expect(verifyFlutterwaveSignature(body + " ", new Headers({ "flutterwave-signature": sig }), hash)).toBe(false);
  });
  it("accepts the legacy verif-hash header", () => {
    expect(verifyFlutterwaveSignature(body, new Headers({ "verif-hash": hash }), hash)).toBe(true);
    expect(verifyFlutterwaveSignature(body, new Headers({ "verif-hash": "nope" }), hash)).toBe(false);
  });
  it("rejects when neither header is present", () => {
    expect(verifyFlutterwaveSignature(body, new Headers(), hash)).toBe(false);
  });
});

describe("Flutterwave amount conversion", () => {
  it("round-trips without float error", () => {
    expect(minorToMajorString(500_050n)).toBe("5000.50");
    expect(minorToMajorString(7n)).toBe("0.07");
    expect(majorToMinor(5000.5)).toBe(500_050n);
    expect(majorToMinor(0.1 + 0.2)).toBe(30n); // 0.30000000000000004 → 30
    expect(majorToMinor("19.99")).toBe(1_999n);
    expect(majorToMinor(100)).toBe(10_000n);
  });
});

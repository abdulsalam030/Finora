import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createOnboardedUser, deleteUser, logIn, withDb } from "./helpers";

// Talks to the real Paystack / Flutterwave sandboxes (test keys from .env).
test.describe.configure({ mode: "serial" });

let user: Awaited<ReturnType<typeof createOnboardedUser>>;
test.beforeAll(async () => {
  user = await createOnboardedUser("fund");
});
test.afterAll(async () => {
  await deleteUser(user.id);
  await withDb((c) => c.query(`DELETE FROM "WebhookEvent" WHERE "eventId" = 'charge.success:999'`));
});

async function latestFunding(userId: string) {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `SELECT reference, status, provider, amount::text, currency FROM "Transaction" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [userId],
    );
    return rows[0] as { reference: string; status: string; provider: string; amount: string; currency: string };
  });
}

test("validates the amount before contacting a gateway", async ({ page }) => {
  await logIn(page, user.email);
  await page.goto("/fund");
  await page.getByLabel(/Amount/).fill("50");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByText("Between ₦100.00 and ₦1,000,000.00")).toBeVisible();
  await expect(page.getByLabel(/Amount/)).toHaveValue("50"); // input survives the round-trip
});

test("Paystack: opens a real sandbox checkout and records a PENDING funding", async ({ page }) => {
  await logIn(page, user.email);
  await page.goto("/fund");
  await page.getByRole("button", { name: "₦5,000" }).click();
  await page.getByRole("button", { name: "Continue to checkout" }).click();

  await page.waitForURL(/checkout\.paystack\.com/, { timeout: 45_000 });
  const tx = await latestFunding(user.id);
  expect(tx).toMatchObject({ status: "PENDING", provider: "PAYSTACK", amount: "500000", currency: "NGN" });

  // Abandon checkout and come back: the status page re-verifies and keeps waiting — no credit.
  await page.goto(`/fund/callback/${tx.reference}`);
  await expect(page.getByText("Confirming your payment…")).toBeVisible();
  expect((await latestFunding(user.id)).status).toBe("PENDING");
});

test("Flutterwave: USD funding opens a real sandbox checkout", async ({ page }) => {
  await logIn(page, user.email);
  await page.goto("/fund");
  await page.locator("label", { hasText: "USD" }).first().click();
  await expect(page.locator("label", { hasText: "Paystack" })).toContainText("USD unavailable");
  await page.getByRole("button", { name: "$25" }).click();
  await page.getByRole("button", { name: "Continue to checkout" }).click();

  await page.waitForURL(/flutterwave\.com/, { timeout: 45_000 });
  expect(await latestFunding(user.id)).toMatchObject({ status: "PENDING", provider: "FLUTTERWAVE", amount: "2500", currency: "USD" });
});

test("webhooks: forged signatures are rejected; signed ones are re-verified, never trusted", async ({ request }) => {
  const { reference } = await withDb(async (c) => {
    const { rows } = await c.query(
      `SELECT reference FROM "Transaction" WHERE "userId" = $1 AND provider = 'PAYSTACK' ORDER BY "createdAt" DESC LIMIT 1`,
      [user.id],
    );
    return rows[0];
  });
  // Claims success for an unpaid checkout.
  const body = JSON.stringify({ event: "charge.success", data: { id: 999, reference, amount: 500000, currency: "NGN", status: "success" } });

  const forged = await request.post("/api/webhooks/paystack", {
    data: body,
    headers: { "content-type": "application/json", "x-paystack-signature": "deadbeef" },
  });
  expect(forged.status()).toBe(401);

  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(body).digest("hex");
  const signed = await request.post("/api/webhooks/paystack", {
    data: body,
    headers: { "content-type": "application/json", "x-paystack-signature": signature },
  });
  expect(signed.status()).toBe(200);

  // Paystack's verify API says it was never paid, so the payload's "success" is ignored.
  const tx = await withDb(async (c) => (await c.query(`SELECT status FROM "Transaction" WHERE reference = $1`, [reference])).rows[0]);
  expect(tx.status).toBe("PENDING");
  const balance = await withDb(async (c) => (await c.query(`SELECT "cachedBalance"::text b FROM "Wallet" WHERE id = $1`, [`${user.id}_NGN`])).rows[0].b);
  expect(balance).toBe("0");

  const fwForged = await request.post("/api/webhooks/flutterwave", {
    data: JSON.stringify({ event: "charge.completed", data: { id: 1, tx_ref: reference } }),
    headers: { "content-type": "application/json", "verif-hash": "wrong" },
  });
  expect(fwForged.status()).toBe(401);
});

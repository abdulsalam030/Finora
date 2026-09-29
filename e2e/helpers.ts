import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Page } from "@playwright/test";
import pg from "pg";

export const password = "correct horse 42";

export async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15_000 });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** A fully onboarded user (verified email, PIN set) with NGN + USD wallets, inserted directly. */
export async function createOnboardedUser(label: string) {
  const id = randomUUID().slice(0, 8);
  const user = { id: `e2e_${label}_${id}`, email: `${label}-${id}@example.com`, username: `${label}_${id}`, name: `E2E ${label}` };
  const [pw, pin] = await Promise.all([bcrypt.hash(password, 4), bcrypt.hash("2580", 4)]);
  await withDb(async (c) => {
    await c.query(
      `INSERT INTO "User" (id, email, username, name, "passwordHash", "pinHash", "emailVerified") VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [user.id, user.email, user.username, user.name, pw, pin],
    );
    for (const cur of ["NGN", "USD"]) {
      await c.query(`INSERT INTO "Wallet" (id, "userId", currency) VALUES ($1,$2,$3)`, [`${user.id}_${cur}`, user.id, cur]);
    }
  });
  return user;
}

export async function deleteUser(userId: string) {
  await withDb(async (c) => {
    await c.query(`DELETE FROM "LedgerEntry" WHERE "transactionId" IN (SELECT id FROM "Transaction" WHERE "userId" = $1)`, [userId]);
    await c.query(`DELETE FROM "Transaction" WHERE "userId" = $1`, [userId]);
    await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
  });
}

export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

const id = randomUUID().slice(0, 8);
const user = { name: "Ada Test", username: `ada_${id}`, email: `ada-${id}@example.com`, password: "correct horse 42" };

async function latestCode(email: string) {
  const mail = JSON.parse(await readFile(`.dev-mail/${email}.json`, "utf8"));
  return mail.subject.match(/\d{6}/)![0] as string;
}

test.afterAll(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`DELETE FROM "User" WHERE email = $1`, [user.email]); // cascades sessions, OTPs, wallets
  await client.end();
});

test.describe.configure({ mode: "serial" });

test("signed-out visitors are sent to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("register → verify email → set PIN → dashboard", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/verify$/);
  await expect(page.getByText(user.email)).toBeVisible();

  // A wrong code is rejected before the real one is accepted.
  const code = await latestCode(user.email);
  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Verification code").fill(wrong);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByText("Incorrect code.")).toBeVisible();

  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/\/set-pin$/);

  // The dashboard is off-limits until a PIN exists.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/set-pin$/);

  await page.getByLabel("New PIN").fill("2580");
  await page.getByLabel("Confirm PIN").fill("2581");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page.getByText("PINs don't match")).toBeVisible();

  await page.getByLabel("New PIN").fill("2580");
  await page.getByLabel("Confirm PIN").fill("2580");
  await page.getByRole("button", { name: "Save PIN" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: user.name })).toBeVisible();
  await expect(page.getByText("₦0.00")).toBeVisible();
  await expect(page.getByText("No transactions yet")).toBeVisible();
});

test("duplicate username is rejected", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Someone Else");
  await page.getByLabel("Username").fill(user.username.toUpperCase()); // usernames are case-insensitive
  await page.getByLabel("Email").fill(`other-${id}@example.com`);
  await page.getByLabel("Password").fill("another password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("That username is taken")).toBeVisible();
});

test("log out, bad password, then log back in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Incorrect email or password")).toBeVisible();

  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Mail = { to: string; subject: string; text: string };

/**
 * Sends via Resend when RESEND_API_KEY is set. Without a key (dev/test only) the mail is logged and
 * written to .dev-mail/<recipient>.json — a local outbox that e2e tests read OTP codes from.
 */
export async function sendMail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not configured");
    console.info(`\n📧 [dev mail] to=${mail.to}\n   ${mail.subject}\n`);
    const dir = path.join(process.cwd(), ".dev-mail");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${mail.to}.json`), JSON.stringify({ ...mail, sentAt: new Date() }, null, 2));
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Pulse Wallet <onboarding@resend.dev>", ...mail }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
}

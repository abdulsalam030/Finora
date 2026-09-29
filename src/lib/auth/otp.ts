import "server-only";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { hmac, safeEqualHex, sixDigitCode } from "./crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function issueOtp(user: { id: string; email: string; name: string }) {
  const latest = await db.otpCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false as const, error: "Please wait a minute before requesting another code." };
  }

  const code = sixDigitCode();
  // Only the newest code is valid.
  await db.$transaction([
    db.otpCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    db.otpCode.create({
      data: { userId: user.id, codeHash: hmac(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    }),
  ]);

  await sendMail({
    to: user.email,
    subject: `${code} is your Pulse Wallet verification code`,
    text: `Hi ${user.name},\n\nYour verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
  });
  return { ok: true as const };
}

export async function verifyOtp(userId: string, code: string) {
  const otp = await db.otpCode.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false as const, error: "Code expired. Request a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false as const, error: "Too many attempts. Request a new code." };

  if (!safeEqualHex(hmac(code), otp.codeHash)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false as const, error: "Incorrect code." };
  }

  await db.$transaction([
    db.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } }),
  ]);
  return { ok: true as const };
}

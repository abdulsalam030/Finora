import "server-only";
import { db } from "@/lib/db";
import { hashSecret, verifySecret } from "./password";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);

export async function setPin(userId: string, pin: string) {
  await db.user.update({
    where: { id: userId },
    data: { pinHash: await hashSecret(pin), pinFailedAttempts: 0, pinLockedUntil: null },
  });
}

/** Checks the transaction PIN, locking it for 15 minutes after 5 consecutive failures. */
export async function checkPin(userId: string, pin: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { pinHash: true, pinFailedAttempts: true, pinLockedUntil: true },
  });
  if (!user.pinHash) return { ok: false as const, error: "Set a transaction PIN first." };
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    return { ok: false as const, error: "PIN locked after too many attempts. Try again in 15 minutes." };
  }

  if (await verifySecret(pin, user.pinHash)) {
    if (user.pinFailedAttempts > 0) {
      await db.user.update({ where: { id: userId }, data: { pinFailedAttempts: 0, pinLockedUntil: null } });
    }
    return { ok: true as const };
  }

  const failures = user.pinFailedAttempts + 1;
  const locked = failures >= MAX_FAILURES;
  await db.user.update({
    where: { id: userId },
    data: { pinFailedAttempts: locked ? 0 : failures, pinLockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null },
  });
  return {
    ok: false as const,
    error: locked ? "PIN locked after too many attempts. Try again in 15 minutes." : `Incorrect PIN. ${MAX_FAILURES - failures} attempts left.`,
  };
}

import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { newToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, userAgent: (await headers()).get("user-agent") },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, whatever their onboarding state. Cached per request. */
export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: { select: { id: true, email: true, username: true, name: true, emailVerified: true, pinHash: true } },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { pinHash, ...user } = session.user;
  return { ...user, hasPin: pinHash !== null };
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/**
 * Gate for pages and actions. Sends the user to whichever onboarding step they still owe.
 * `stage` lets onboarding pages themselves be reachable before later steps are done.
 */
export async function requireUser(stage: "verified" | "complete" = "complete"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.emailVerified) redirect("/verify");
  if (stage === "complete" && !user.hasPin) redirect("/set-pin");
  return user;
}

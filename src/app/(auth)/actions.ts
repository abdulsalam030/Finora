"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { burnTime, hashSecret, verifySecret } from "@/lib/auth/password";
import { setPin } from "@/lib/auth/pin";
import { createSession, destroySession, getSessionUser, requireUser } from "@/lib/auth/session";
import { echo, fieldErrors, loginSchema, otpSchema, pinSchema, registerSchema, type FormState } from "@/lib/validation";

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await register(form);
  return { ...result, values: echo(form, ["name", "username", "email"]) };
}

async function register(form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { password, ...profile } = parsed.data;

  const taken = await takenFields(profile);
  if (taken) return taken;

  let user;
  try {
    user = await db.user.create({
      data: {
        ...profile,
        passwordHash: await hashSecret(password),
        wallets: { create: [{ currency: "NGN" }, { currency: "USD" }] },
      },
    });
  } catch (err) {
    // Lost a race with a concurrent sign-up. The driver adapter doesn't name the violated
    // field reliably, so look it up rather than parsing the error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return (await takenFields(profile)) ?? { error: "Could not create account. Please try again." };
    }
    throw err;
  }

  await createSession(user.id);
  await issueOtp(user);
  redirect("/verify");
}

async function takenFields({ email, username }: { email: string; username: string }): Promise<FormState | null> {
  const clashes = await db.user.findMany({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (!clashes.length) return null;
  const fieldErrors: FormState["fieldErrors"] = {};
  if (clashes.some((u) => u.email === email)) fieldErrors.email = ["An account with this email already exists"];
  if (clashes.some((u) => u.username === username)) fieldErrors.username = ["That username is taken"];
  return { fieldErrors };
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await login(form);
  return { ...result, values: echo(form, ["email"]) };
}

async function login(form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    await burnTime(parsed.data.password);
    return { error: "Incorrect email or password" };
  }
  if (!(await verifySecret(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password" };
  }

  await createSession(user.id);
  if (!user.emailVerified) {
    await issueOtp(user); // may be on cooldown — the verify page offers resend
    redirect("/verify");
  }
  redirect("/dashboard");
}

export async function verifyOtpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/dashboard");

  const parsed = otpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);

  const result = await verifyOtp(user.id, parsed.data.code);
  if (!result.ok) return { error: result.error };
  redirect("/set-pin");
}

export async function resendOtpAction(): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/dashboard");
  const result = await issueOtp(user);
  return result.ok ? { message: "A new code is on its way." } : { error: result.error };
}

export async function setPinAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("verified");
  if (user.hasPin) redirect("/dashboard");

  const parsed = pinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fieldErrors(parsed.error);

  await setPin(user.id, parsed.data.pin);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

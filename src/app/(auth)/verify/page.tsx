import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { VerifyForm } from "./VerifyForm";

export default async function VerifyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/dashboard");
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Check your email</h1>
      <p className="mb-6 text-sm text-muted">
        We sent a 6-digit code to <span className="text-fg">{user.email}</span>.
      </p>
      <VerifyForm />
    </>
  );
}

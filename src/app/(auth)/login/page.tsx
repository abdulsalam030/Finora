import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-muted">Log in to your wallet.</p>
      <LoginForm />
    </>
  );
}

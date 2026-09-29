import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Create your wallet</h1>
      <p className="mb-6 text-sm text-muted">It takes less than a minute.</p>
      <RegisterForm />
    </>
  );
}

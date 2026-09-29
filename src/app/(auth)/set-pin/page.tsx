import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { SetPinForm } from "./SetPinForm";

export default async function SetPinPage() {
  const user = await requireUser("verified");
  if (user.hasPin) redirect("/dashboard");
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Set a transaction PIN</h1>
      <p className="mb-6 text-sm text-muted">You&apos;ll use this 4-digit PIN to approve transfers and reveal card details.</p>
      <SetPinForm />
    </>
  );
}

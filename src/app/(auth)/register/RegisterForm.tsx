"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "../actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});
  const e = state.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Full name" name="name" defaultValue={state.values?.name} autoComplete="name" required errors={e?.name} />
      <Field label="Username" name="username" defaultValue={state.values?.username} autoComplete="username" autoCapitalize="none" required errors={e?.username} />
      <Field label="Email" name="email" defaultValue={state.values?.email} type="email" autoComplete="email" required errors={e?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required errors={e?.password} />
      <SubmitButton>Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="text-brand">Log in</Link>
      </p>
    </form>
  );
}

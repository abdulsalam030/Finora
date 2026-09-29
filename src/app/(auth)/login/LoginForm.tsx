"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email" name="email" defaultValue={state.values?.email} type="email" autoComplete="email" required errors={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required errors={state.fieldErrors?.password} />
      <SubmitButton>Log in</SubmitButton>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/register" className="text-brand">Create an account</Link>
      </p>
    </form>
  );
}

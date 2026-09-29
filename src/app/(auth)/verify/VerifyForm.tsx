"use client";

import { useActionState } from "react";
import { resendOtpAction, verifyOtpAction } from "../actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function VerifyForm() {
  const [state, action] = useActionState(verifyOtpAction, {});
  const [resendState, resend, resending] = useActionState(resendOtpAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <FormMessage state={state.error || state.fieldErrors ? state : resendState} />
        <Field
          label="Verification code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          className="text-center font-mono text-2xl tracking-[0.5em]"
          errors={state.fieldErrors?.code}
        />
        <SubmitButton>Verify email</SubmitButton>
      </form>
      <form action={resend}>
        <button type="submit" disabled={resending} className="w-full text-sm text-muted underline-offset-4 hover:underline disabled:opacity-50">
          Didn&apos;t get it? Resend code
        </button>
      </form>
    </div>
  );
}

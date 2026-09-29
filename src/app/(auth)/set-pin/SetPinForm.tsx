"use client";

import { useActionState } from "react";
import { setPinAction } from "../actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

const pinProps = {
  type: "password",
  inputMode: "numeric",
  autoComplete: "off",
  pattern: "\\d{4}",
  maxLength: 4,
  required: true,
  className: "text-center font-mono text-2xl tracking-[0.75em]",
} as const;

export function SetPinForm() {
  const [state, action] = useActionState(setPinAction, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="New PIN" name="pin" errors={state.fieldErrors?.pin} {...pinProps} />
      <Field label="Confirm PIN" name="confirm" errors={state.fieldErrors?.confirm} {...pinProps} />
      <SubmitButton>Save PIN</SubmitButton>
    </form>
  );
}

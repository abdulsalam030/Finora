"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/utils";
import { startFundingAction } from "./actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

const QUICK = { NGN: ["1,000", "5,000", "10,000", "50,000"], USD: ["10", "25", "50", "100"] } as const;
const PROVIDERS = [
  { id: "PAYSTACK", label: "Paystack", currencies: ["NGN"] },
  { id: "FLUTTERWAVE", label: "Flutterwave", currencies: ["NGN", "USD"] },
] as const;

type Currency = keyof typeof QUICK;

export function FundForm() {
  const [state, action] = useActionState(startFundingAction, {});
  const [currency, setCurrency] = useState<Currency>((state.values?.currency as Currency) ?? "NGN");
  const [amount, setAmount] = useState(state.values?.amount ?? "");
  const [provider, setProvider] = useState(state.values?.provider ?? "PAYSTACK");

  // Paystack is NGN-only; switch gateway automatically when the currency rules it out.
  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    setAmount("");
    if (!PROVIDERS.find((p) => p.id === provider)!.currencies.includes(c as never)) setProvider("FLUTTERWAVE");
  };

  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />

      <fieldset>
        <legend className="mb-2 text-sm text-muted">Wallet</legend>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
          {(["NGN", "USD"] as const).map((c) => (
            <label key={c} className={cn("cursor-pointer rounded-lg py-2 text-center text-sm", currency === c && "bg-surface-2 font-semibold")}>
              <input type="radio" name="currency" value={c} checked={currency === c} onChange={() => pickCurrency(c)} className="sr-only" />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Field
          label={`Amount (${currency === "NGN" ? "₦" : "$"})`}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-semibold tabular-nums"
          errors={state.fieldErrors?.amount}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK[currency].map((q) => (
            <button key={q} type="button" onClick={() => setAmount(q)} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs">
              {currency === "NGN" ? "₦" : "$"}
              {q}
            </button>
          ))}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-muted">Pay with</legend>
        <div className="space-y-2">
          {PROVIDERS.map((p) => {
            const supported = p.currencies.includes(currency as never);
            return (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface px-4 py-3",
                  provider === p.id && "border-brand",
                  !supported && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs text-muted">{supported ? p.currencies.join(" · ") : `${currency} unavailable`}</span>
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={provider === p.id}
                  disabled={!supported}
                  onChange={() => setProvider(p.id)}
                  className="sr-only"
                />
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.provider && <p className="mt-1 text-xs text-danger">{state.fieldErrors.provider[0]}</p>}
      </fieldset>

      <SubmitButton>Continue to checkout</SubmitButton>
      <p className="text-center text-xs text-muted">Test mode — no real money moves.</p>
    </form>
  );
}

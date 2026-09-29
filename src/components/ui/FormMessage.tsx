import type { FormState } from "@/lib/validation";

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</p>;
  if (state.message) return <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{state.message}</p>;
  return null;
}

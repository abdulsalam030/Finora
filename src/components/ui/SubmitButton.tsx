"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(
        "bg-card-gradient w-full rounded-xl py-3.5 font-semibold text-white transition active:scale-[0.99] disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

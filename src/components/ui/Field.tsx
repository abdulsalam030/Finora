import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string; errors?: string[] };

export function Field({ label, errors, className, id, name, ...props }: Props) {
  const inputId = id ?? name;
  const errorId = errors?.length ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none transition focus:border-brand",
          errors?.length && "border-danger",
          className,
        )}
        {...props}
      />
      {errorId && (
        <p id={errorId} className="text-xs text-danger">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

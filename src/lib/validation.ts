import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: letters, numbers, underscore"),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export const pinSchema = z
  .object({
    pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
    confirm: z.string(),
  })
  .refine((v) => v.pin === v.confirm, { message: "PINs don't match", path: ["confirm"] })
  .refine((v) => !["0000", "1234", "1111", "4321"].includes(v.pin), { message: "Choose a less guessable PIN", path: ["pin"] });

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  /** Non-secret input echoed back so fields survive React 19's post-action form reset. */
  values?: Record<string, string>;
};

export function fieldErrors(error: z.ZodError): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors as FormState["fieldErrors"] };
}

export function echo(form: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));
}

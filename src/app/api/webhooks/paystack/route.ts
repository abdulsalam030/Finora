import { handleWebhook } from "@/lib/webhooks";

export const POST = (req: Request) => handleWebhook("PAYSTACK", req);

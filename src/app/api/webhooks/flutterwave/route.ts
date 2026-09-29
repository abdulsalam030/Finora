import { handleWebhook } from "@/lib/webhooks";

export const POST = (req: Request) => handleWebhook("FLUTTERWAVE", req);

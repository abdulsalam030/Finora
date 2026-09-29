import { flutterwave } from "./flutterwave";
import { paystack } from "./paystack";
import type { PaymentProvider, ProviderName } from "./types";

export * from "./types";

const providers: Record<ProviderName, PaymentProvider> = { PAYSTACK: paystack, FLUTTERWAVE: flutterwave };

export function getProvider(name: ProviderName): PaymentProvider {
  return providers[name];
}

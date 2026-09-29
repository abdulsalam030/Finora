import "server-only";
import { db } from "@/lib/db";
import { settleFunding } from "@/lib/funding";
import { getProvider, type ProviderName } from "@/lib/payments";

/**
 * Shared webhook pipeline: verify signature → settle via the gateway's verify API → log the event.
 * A non-2xx response makes the gateway retry, so we only answer 200 once the work is done.
 */
export async function handleWebhook(provider: ProviderName, req: Request) {
  const rawBody = await req.text(); // signatures are over the exact bytes received
  let event;
  try {
    event = getProvider(provider).parseWebhook(rawBody, req.headers);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  if (!event) return new Response("Ignored", { status: 401 });

  try {
    await settleFunding(event.reference);
  } catch (err) {
    console.error(`[webhook:${provider}] settle failed for ${event.reference}`, err);
    return new Response("Retry later", { status: 500 });
  }

  await db.webhookEvent.upsert({
    where: { provider_eventId: { provider, eventId: event.eventId } },
    create: { provider, eventId: event.eventId, payload: JSON.parse(rawBody) },
    update: {},
  });
  return Response.json({ received: true });
}

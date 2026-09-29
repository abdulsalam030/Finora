import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { settleFunding } from "@/lib/funding";

/** Status of one of the signed-in user's transactions. Pending fundings are re-verified with the gateway. */
export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const user = await getSessionUser();
  if (!user?.emailVerified) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { reference } = await params;
  let tx = await db.transaction.findUnique({ where: { reference } });
  if (!tx || tx.userId !== user.id) return Response.json({ error: "Not found" }, { status: 404 });

  if (tx.type === "FUNDING" && tx.status === "PENDING") {
    tx = (await settleFunding(reference).catch(() => null)) ?? tx;
  }

  return Response.json({
    reference: tx.reference,
    type: tx.type,
    status: tx.status,
    amount: tx.amount.toString(), // BigInt isn't JSON — send minor units as a string
    currency: tx.currency,
    description: tx.description,
    completedAt: tx.completedAt,
  });
}

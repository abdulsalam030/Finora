import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FundingStatus } from "./FundingStatus";

export default async function FundingCallbackPage({ params }: { params: Promise<{ reference: string }> }) {
  const user = await requireUser();
  const { reference } = await params;
  const tx = await db.transaction.findUnique({ where: { reference }, select: { userId: true, type: true } });
  if (!tx || tx.userId !== user.id || tx.type !== "FUNDING") notFound();
  return <FundingStatus reference={reference} />;
}

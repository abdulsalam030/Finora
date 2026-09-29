"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { useGetTransactionStatusQuery } from "@/store/transactionsApi";

const POLL_MS = 3_000;
const GIVE_UP_MS = 2 * 60_000;

export function FundingStatus({ reference }: { reference: string }) {
  const [timedOut, setTimedOut] = useState(false);
  const { data, isError } = useGetTransactionStatusQuery(reference, {
    pollingInterval: POLL_MS,
    skipPollingIfUnfocused: true,
  });
  const status = data?.status;
  const settled = status === "SUCCESS" || status === "FAILED";

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, []);

  // Stop polling once final (or after the give-up window) by unmounting the subscription.
  if (settled || timedOut) return <Result data={data} timedOut={timedOut && !settled} />;
  if (isError) return <Result data={undefined} timedOut />;

  return (
    <div className="flex flex-col items-center py-16 text-center" role="status">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
        <Clock className="text-brand" size={48} />
      </motion.div>
      <p className="mt-6 text-lg font-semibold">Confirming your payment…</p>
      <p className="mt-2 text-sm text-muted">We credit your wallet only after the gateway confirms it.</p>
    </div>
  );
}

function Result({ data, timedOut }: { data: ReturnType<typeof useGetTransactionStatusQuery>["data"]; timedOut: boolean }) {
  const ok = data?.status === "SUCCESS";
  const Icon = timedOut ? Clock : ok ? CheckCircle2 : XCircle;
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center py-16 text-center" role="status">
      <Icon size={56} className={timedOut ? "text-muted" : ok ? "text-success" : "text-danger"} />
      <p className="mt-6 text-lg font-semibold">
        {timedOut ? "Still processing" : ok ? "Wallet funded" : "Payment not completed"}
      </p>
      {data && !timedOut && <p className="mt-1 text-3xl font-semibold tabular-nums">{formatMoney(data.amount, data.currency)}</p>}
      <p className="mt-2 max-w-xs text-sm text-muted">
        {timedOut
          ? "Your bank hasn't confirmed yet. We'll credit your wallet automatically as soon as it does."
          : ok
            ? "The money is in your wallet."
            : (data?.description ?? "No money was taken from your wallet.")}
      </p>
      <p className="mt-4 font-mono text-xs text-muted">Ref {data?.reference}</p>
      <div className="mt-8 flex w-full gap-3">
        {!ok && (
          <Link href="/fund" className="flex-1 rounded-xl bg-surface-2 py-3.5 text-center font-semibold">
            Try again
          </Link>
        )}
        <Link href="/dashboard" className="bg-card-gradient flex-1 rounded-xl py-3.5 text-center font-semibold text-white">
          Done
        </Link>
      </div>
    </motion.div>
  );
}

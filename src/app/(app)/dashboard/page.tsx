import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CreditCard, LogOut, QrCode } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { BalanceCard } from "@/components/BalanceCard";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

const actions = [
  { label: "Fund", icon: ArrowDownLeft, href: "/fund" },
  { label: "Send", icon: ArrowUpRight, href: null },
  { label: "Cards", icon: CreditCard, href: null },
  { label: "Pay me", icon: QrCode, href: null },
];


const TYPE_LABEL = { FUNDING: "Wallet funding", TRANSFER: "Transfer", CARD_FUND: "Card top-up", CARD_SPEND: "Card payment" } as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const wallets = await db.wallet.findMany({ where: { userId: user.id }, orderBy: { currency: "asc" } });
  const primary = wallets.find((w) => w.currency === "NGN") ?? wallets[0];

  // Recent activity from this user's point of view: their wallet's side of each posting.
  const recent = await db.ledgerEntry.findMany({
    where: { walletId: { in: wallets.map((w) => w.id) } },
    include: { transaction: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()}</p>
          <h1 className="text-xl font-semibold">{user.name}</h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" aria-label="Log out" className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted">
            <LogOut size={18} />
          </button>
        </form>
      </header>

      {primary && <BalanceCard balanceMinor={primary.cachedBalance} currency={primary.currency} handle={user.username} holder={user.name} />}

      <nav className="mt-6 grid grid-cols-4 gap-3">
        {actions.map(({ label, icon: Icon, href }) => {
          const content = (
            <>
              <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-fg">
                <Icon size={20} />
              </span>
              {label}
            </>
          );
          return href ? (
            <Link key={label} href={href} className="flex flex-col items-center gap-2 text-xs text-muted">
              {content}
            </Link>
          ) : (
            // Not built yet — shown so the layout matches the final app.
            <span key={label} aria-disabled className="flex flex-col items-center gap-2 text-xs text-muted opacity-40">
              {content}
            </span>
          );
        })}
      </nav>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <div className="rounded-2xl bg-surface p-6 text-center text-sm text-muted">
            No transactions yet. Fund your wallet to get started.
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {recent.map((e) => {
              const incoming = e.direction === "CREDIT";
              return (
                <li key={e.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm">{e.transaction.description ?? TYPE_LABEL[e.transaction.type]}</p>
                    <p className="text-xs text-muted">{e.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <span className={`text-sm tabular-nums ${incoming ? "text-success" : "text-fg"}`}>
                    {incoming ? "+" : "−"}
                    {formatMoney(e.amount, e.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

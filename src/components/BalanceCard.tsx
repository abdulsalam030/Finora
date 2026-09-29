"use client";

import { Eye, EyeOff } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/money";
import { useAppDispatch, useAppSelector } from "@/store";
import { toggleBalanceHidden } from "@/store/uiSlice";

type Props = { balanceMinor: bigint; currency: Currency; handle: string; holder: string };

export function BalanceCard({ balanceMinor, currency, handle, holder }: Props) {
  const hidden = useAppSelector((s) => s.ui.balanceHidden);
  const dispatch = useAppDispatch();

  return (
    <div className="bg-card-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_20px_60px_-20px_rgba(255,61,127,0.6)]">
      <div className="flex items-center justify-between text-xs font-semibold tracking-widest">
        <span>PULSE</span>
        <span className="opacity-80">{currency} WALLET</span>
      </div>
      <div className="mt-8 flex items-end justify-between">
        <div>
          <p className="text-xs opacity-80">Available balance</p>
          <p className="text-3xl font-semibold tabular-nums">{hidden ? "••••••" : formatMoney(balanceMinor, currency)}</p>
        </div>
        <button
          type="button"
          onClick={() => dispatch(toggleBalanceHidden())}
          aria-label={hidden ? "Show balance" : "Hide balance"}
          className="rounded-full bg-white/20 p-2 backdrop-blur"
        >
          {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      <div className="mt-5 flex justify-between text-xs opacity-80">
        <span className="uppercase">{holder}</span>
        <span>@{handle}</span>
      </div>
    </div>
  );
}

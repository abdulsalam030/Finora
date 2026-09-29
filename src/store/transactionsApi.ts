import type { Currency } from "@/lib/money";
import { api } from "./api";

export type TransactionStatusDto = {
  reference: string;
  type: "FUNDING" | "TRANSFER" | "CARD_FUND" | "CARD_SPEND";
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount: string;
  currency: Currency;
  description: string | null;
  completedAt: string | null;
};

export const transactionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getTransactionStatus: build.query<TransactionStatusDto, string>({
      query: (reference) => `/transactions/${encodeURIComponent(reference)}`,
      providesTags: (_res, _err, reference) => [{ type: "Transactions", id: reference }],
    }),
  }),
});

export const { useGetTransactionStatusQuery } = transactionsApi;

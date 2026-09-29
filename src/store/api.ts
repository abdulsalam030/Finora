import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Endpoints are injected per feature slice (wallet, transactions, cards).
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Wallet", "Transactions", "Cards", "Notifications"],
  endpoints: () => ({}),
});

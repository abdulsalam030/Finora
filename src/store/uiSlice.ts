import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Currency } from "@/lib/money";

type UiState = { displayCurrency: Currency; balanceHidden: boolean };

const initialState: UiState = { displayCurrency: "NGN", balanceHidden: false };

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setDisplayCurrency(state, action: PayloadAction<Currency>) {
      state.displayCurrency = action.payload;
    },
    toggleBalanceHidden(state) {
      state.balanceHidden = !state.balanceHidden;
    },
  },
});

export const { setDisplayCurrency, toggleBalanceHidden } = uiSlice.actions;

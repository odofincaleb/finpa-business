import { useBusiness } from "../context/BusinessContext";

export function useExpenses() {
  const { expenses, addExpense, categories, loading, refresh } = useBusiness();
  return { expenses, addExpense, categories, loading, refresh };
}

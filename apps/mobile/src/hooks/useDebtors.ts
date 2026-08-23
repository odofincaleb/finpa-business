import { useBusiness } from "../context/BusinessContext";

export function useDebtors() {
  const { debtors, addDebtor, recordDebtorPayment, markDebtorPaid, loading, refresh } =
    useBusiness();
  return { debtors, addDebtor, recordDebtorPayment, markDebtorPaid, loading, refresh };
}

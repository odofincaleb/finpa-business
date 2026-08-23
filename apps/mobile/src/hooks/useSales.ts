import { useBusiness } from "../context/BusinessContext";

export function useSales() {
  const { sales, addSale, loading, refresh } = useBusiness();
  return { sales, addSale, loading, refresh };
}

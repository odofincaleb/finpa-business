import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { useAuth } from "./AuthContext";
import {
  addDebtorPaymentApi,
  createBusinessProfileApi,
  createDebtorApi,
  createExpenseApi,
  createSaleApi,
  fetchBusinessProfile,
  fetchDashboard,
  fetchDebtors,
  fetchExpenseCategories,
  fetchExpenses,
  fetchSales,
  markDebtorPaidApi,
  type ExpenseWrite,
  type SaleWrite,
} from "../lib/api";
import type {
  BusinessProfile,
  DashboardSummary,
  Debtor,
  Expense,
  ExpenseCategory,
  Sale,
} from "../types";

const emptyDash: DashboardSummary = {
  todaySales: 0,
  todayExpenses: 0,
  estimatedProfit: 0,
  salesCount: 0,
  openDebtors: 0,
  recentTransactions: [],
};

type BusinessContextValue = {
  loading: boolean;
  business: BusinessProfile | null;
  dashboard: DashboardSummary;
  weekly: DashboardSummary;
  sales: Sale[];
  expenses: Expense[];
  debtors: Debtor[];
  categories: ExpenseCategory[];
  isOnline: boolean;
  pendingSyncCount: number;
  syncStatusLine: string;
  ensureBusiness: (name?: string) => Promise<BusinessProfile | null>;
  refresh: () => Promise<void>;
  addSale: (input: SaleWrite) => Promise<Sale | null>;
  addExpense: (input: ExpenseWrite) => Promise<Expense | null>;
  addDebtor: (input: {
    customer_name: string;
    phone?: string;
    total_amount: number;
    due_date?: string;
    notes?: string;
  }) => Promise<Debtor | null>;
  recordDebtorPayment: (id: string, amount: number, note?: string) => Promise<void>;
  markDebtorPaid: (debtor: Debtor) => Promise<void>;
  flushSyncQueue: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { token, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDash);
  const [weekly, setWeekly] = useState<DashboardSummary>(emptyDash);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState<Array<{ kind: "sale" | "expense"; payload: SaleWrite | ExpenseWrite }>>(
    [],
  );

  const ensureBusiness = useCallback(
    async (name?: string) => {
      if (!token) return null;
      const existing = await fetchBusinessProfile(token);
      if (existing.profile) {
        setBusiness(existing.profile);
        return existing.profile;
      }
      const created = await createBusinessProfileApi(token, {
        business_name: name?.trim() || profile?.email?.split("@")[0] || "My Business",
        currency: profile?.preferred_currency || "NGN",
      });
      setBusiness(created.profile);
      return created.profile;
    },
    [token, profile?.email, profile?.preferred_currency],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      await ensureBusiness();
      const [dash, week, saleRes, expRes, debtorRes, cats] = await Promise.all([
        fetchDashboard(token, "today"),
        fetchDashboard(token, "weekly"),
        fetchSales(token),
        fetchExpenses(token),
        fetchDebtors(token, "all"),
        fetchExpenseCategories(token).catch(() => ({ categories: [] })),
      ]);
      setDashboard(dash);
      setWeekly(week);
      setSales(saleRes.sales);
      setExpenses(expRes.expenses);
      setDebtors(debtorRes.debtors);
      setCategories(cats.categories);
    } catch {
      // offline: keep last known
    } finally {
      setLoading(false);
    }
  }, [token, ensureBusiness]);

  const flushSyncQueue = useCallback(async () => {
    if (!token || !pending.length) return;
    const left: typeof pending = [];
    for (const item of pending) {
      try {
        if (item.kind === "sale") await createSaleApi(token, item.payload as SaleWrite);
        else await createExpenseApi(token, item.payload as ExpenseWrite);
      } catch {
        left.push(item);
      }
    }
    setPending(left);
    if (left.length < pending.length) await refresh();
  }, [token, pending, refresh]);

  const addSale = useCallback(
    async (input: SaleWrite) => {
      if (!token) return null;
      try {
        const { sale } = await createSaleApi(token, input);
        setSales((prev) => [sale, ...prev]);
        await refresh();
        return sale;
      } catch {
        setPending((p) => [...p, { kind: "sale", payload: input }]);
        const local: Sale = {
          id: `local-${Date.now()}`,
          business_id: business?.id ?? "",
          amount: input.amount,
          item_or_service: input.item_or_service ?? "",
          payment_method: input.payment_method || "cash",
          customer_name: input.customer_name ?? null,
          quantity: input.quantity ?? 1,
          unit_price: input.unit_price ?? null,
          sold_at: input.sold_at ?? new Date().toISOString(),
          notes: input.notes ?? null,
          created_by: profile?.id ?? "",
          created_at: new Date().toISOString(),
          client_id: input.client_id ?? null,
          sync_status: "pending",
        };
        setSales((prev) => [local, ...prev]);
        return local;
      }
    },
    [token, business?.id, profile?.id, refresh],
  );

  const addExpense = useCallback(
    async (input: ExpenseWrite) => {
      if (!token) return null;
      try {
        const { expense } = await createExpenseApi(token, input);
        setExpenses((prev) => [expense, ...prev]);
        await refresh();
        return expense;
      } catch {
        setPending((p) => [...p, { kind: "expense", payload: input }]);
        const local: Expense = {
          id: `local-${Date.now()}`,
          business_id: business?.id ?? "",
          amount: input.amount,
          category: input.category || "general",
          payment_method: input.payment_method || "cash",
          notes: input.notes ?? null,
          incurred_at: input.incurred_at ?? new Date().toISOString(),
          created_by: profile?.id ?? "",
          created_at: new Date().toISOString(),
          client_id: input.client_id ?? null,
          sync_status: "pending",
        };
        setExpenses((prev) => [local, ...prev]);
        return local;
      }
    },
    [token, business?.id, profile?.id, refresh],
  );

  const addDebtor = useCallback(
    async (input: {
      customer_name: string;
      phone?: string;
      total_amount: number;
      due_date?: string;
      notes?: string;
    }) => {
      if (!token) return null;
      const { debtor } = await createDebtorApi(token, input);
      setDebtors((prev) => [debtor, ...prev]);
      await refresh();
      return debtor;
    },
    [token, refresh],
  );

  const recordDebtorPayment = useCallback(
    async (id: string, amount: number, note?: string) => {
      if (!token) return;
      const { debtor } = await addDebtorPaymentApi(token, id, amount, note);
      setDebtors((prev) => prev.map((d) => (d.id === id ? debtor : d)));
      await refresh();
    },
    [token, refresh],
  );

  const markDebtorPaid = useCallback(
    async (debtor: Debtor) => {
      if (!token) return;
      const { debtor: next } = await markDebtorPaidApi(token, debtor);
      setDebtors((prev) => prev.map((d) => (d.id === debtor.id ? next : d)));
      await refresh();
    },
    [token, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) void flushSyncQueue();
    };
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [flushSyncQueue]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      loading,
      business,
      dashboard,
      weekly,
      sales,
      expenses,
      debtors,
      categories,
      isOnline,
      pendingSyncCount: pending.length,
      syncStatusLine: !isOnline
        ? pending.length
          ? `Offline · ${pending.length} waiting to sync`
          : "Offline"
        : pending.length
          ? `${pending.length} pending sync`
          : "",
      ensureBusiness,
      refresh,
      addSale,
      addExpense,
      addDebtor,
      recordDebtorPayment,
      markDebtorPaid,
      flushSyncQueue,
    }),
    [
      loading,
      business,
      dashboard,
      weekly,
      sales,
      expenses,
      debtors,
      categories,
      isOnline,
      pending.length,
      ensureBusiness,
      refresh,
      addSale,
      addExpense,
      addDebtor,
      recordDebtorPayment,
      markDebtorPaid,
      flushSyncQueue,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used inside BusinessProvider");
  return ctx;
}

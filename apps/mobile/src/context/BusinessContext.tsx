import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { syncQueueKey } from "../lib/userStorage";
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

type PendingItem =
  | { kind: "sale"; payload: SaleWrite }
  | { kind: "expense"; payload: ExpenseWrite }
  | {
      kind: "debtor";
      payload: {
        customer_name: string;
        phone?: string;
        total_amount: number;
        amount_paid?: number;
        notes?: string;
      };
    };

export type IngestCreatedInput = {
  sales?: Sale[];
  expenses?: Expense[];
  debtor?: Debtor | null;
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
    amount_paid?: number;
    due_date?: string;
    notes?: string;
  }) => Promise<Debtor | null>;
  recordDebtorPayment: (id: string, amount: number, note?: string) => Promise<void>;
  markDebtorPaid: (debtor: Debtor) => Promise<void>;
  flushSyncQueue: () => Promise<void>;
  ingestCreated: (input: IngestCreatedInput) => void;
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
  const [pending, setPending] = useState<PendingItem[]>([]);

  const persistPending = useCallback(
    async (items: PendingItem[]) => {
      if (!profile?.id) return;
      try {
        await AsyncStorage.setItem(syncQueueKey(profile.id), JSON.stringify(items));
      } catch {
        // ignore
      }
    },
    [profile?.id],
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
    const left: PendingItem[] = [];
    for (const item of pending) {
      try {
        if (item.kind === "sale") await createSaleApi(token, item.payload);
        else if (item.kind === "expense") await createExpenseApi(token, item.payload);
        else await createDebtorApi(token, item.payload);
      } catch {
        left.push(item);
      }
    }
    setPending(left);
    void persistPending(left);
    if (left.length < pending.length) await refresh();
  }, [token, pending, refresh, persistPending]);

  const bumpRecent = useCallback(
    (kind: "sale" | "expense", amount: number, title: string, method: string, id: string) => {
      const occurred_at = new Date().toISOString();
      setDashboard((d) => {
        const todaySales = kind === "sale" ? d.todaySales + amount : d.todaySales;
        const todayExpenses = kind === "expense" ? d.todayExpenses + amount : d.todayExpenses;
        return {
          ...d,
          todaySales,
          todayExpenses,
          estimatedProfit: todaySales - todayExpenses,
          salesCount: kind === "sale" ? d.salesCount + 1 : d.salesCount,
          recentTransactions: [
            { kind, id, amount, title, payment_method: method, occurred_at },
            ...d.recentTransactions,
          ].slice(0, 10),
        };
      });
    },
    [],
  );

  const ingestCreated = useCallback(
    (input: IngestCreatedInput) => {
      if (input.sales?.length) {
        setSales((prev) => [...input.sales!, ...prev]);
        for (const sale of input.sales) {
          bumpRecent("sale", sale.amount, sale.item_or_service || "Sale", sale.payment_method, sale.id);
        }
      }
      if (input.expenses?.length) {
        setExpenses((prev) => [...input.expenses!, ...prev]);
        for (const expense of input.expenses) {
          bumpRecent(
            "expense",
            expense.amount,
            expense.category || "Expense",
            expense.payment_method,
            expense.id,
          );
        }
      }
      if (input.debtor) {
        setDebtors((prev) => [input.debtor!, ...prev]);
        setDashboard((d) => ({
          ...d,
          openDebtors: d.openDebtors + (input.debtor!.status === "paid" ? 0 : 1),
        }));
      }
    },
    [bumpRecent],
  );

  const addSale = useCallback(
    async (input: SaleWrite) => {
      if (!token) return null;
      try {
        const { sale } = await createSaleApi(token, input);
        setSales((prev) => [sale, ...prev]);
        bumpRecent("sale", sale.amount, sale.item_or_service || "Sale", sale.payment_method, sale.id);
        void refresh();
        return sale;
      } catch {
        setPending((p) => {
          const next = [...p, { kind: "sale" as const, payload: input }];
          void persistPending(next);
          return next;
        });
        bumpRecent(
          "sale",
          input.amount,
          input.item_or_service || "Sale",
          input.payment_method || "cash",
          `local-${Date.now()}`,
        );
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
    [token, business?.id, profile?.id, refresh, bumpRecent, persistPending],
  );

  const addExpense = useCallback(
    async (input: ExpenseWrite) => {
      if (!token) return null;
      try {
        const { expense } = await createExpenseApi(token, input);
        setExpenses((prev) => [expense, ...prev]);
        bumpRecent("expense", expense.amount, expense.category || "Expense", expense.payment_method, expense.id);
        void refresh();
        return expense;
      } catch {
        setPending((p) => {
          const next = [...p, { kind: "expense" as const, payload: input }];
          void persistPending(next);
          return next;
        });
        bumpRecent(
          "expense",
          input.amount,
          input.category || "Expense",
          input.payment_method || "cash",
          `local-${Date.now()}`,
        );
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
    [token, business?.id, profile?.id, refresh, bumpRecent, persistPending],
  );

  const addDebtor = useCallback(
    async (input: {
      customer_name: string;
      phone?: string;
      total_amount: number;
      amount_paid?: number;
      due_date?: string;
      notes?: string;
    }) => {
      if (!token) return null;
      try {
        const { debtor } = await createDebtorApi(token, input);
        setDebtors((prev) => [debtor, ...prev]);
        setDashboard((d) => ({ ...d, openDebtors: d.openDebtors + (debtor.status === "paid" ? 0 : 1) }));
        void refresh();
        return debtor;
      } catch {
        setPending((p) => {
          const next = [...p, { kind: "debtor" as const, payload: input }];
          void persistPending(next);
          return next;
        });
        const paid = input.amount_paid ?? 0;
        const local: Debtor = {
          id: `local-${Date.now()}`,
          business_id: business?.id ?? "",
          customer_name: input.customer_name,
          phone: input.phone ?? null,
          total_amount: input.total_amount,
          amount_paid: paid,
          balance: input.total_amount - paid,
          due_date: input.due_date ?? null,
          status: paid <= 0 ? "open" : paid >= input.total_amount ? "paid" : "partial",
          notes: input.notes ?? null,
          created_by: profile?.id ?? "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDebtors((prev) => [local, ...prev]);
        return local;
      }
    },
    [token, refresh, persistPending, business?.id, profile?.id],
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
    if (!profile?.id) {
      setPending([]);
      return;
    }
    let cancelled = false;
    void AsyncStorage.getItem(syncQueueKey(profile.id)).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const items = JSON.parse(raw) as PendingItem[];
        if (Array.isArray(items)) setPending(items);
      } catch {
        // ignore bad queue
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

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
      syncStatusLine: pending.length
        ? `${pending.length} item${pending.length === 1 ? "" : "s"} waiting to sync`
        : !isOnline
          ? "Offline"
          : "",
      ensureBusiness,
      refresh,
      addSale,
      addExpense,
      addDebtor,
      recordDebtorPayment,
      markDebtorPaid,
      flushSyncQueue,
      ingestCreated,
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
      ingestCreated,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used inside BusinessProvider");
  return ctx;
}

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Rent", icon: "🏠" },
  { name: "Utilities", icon: "⚡" },
  { name: "Salaries", icon: "👥" },
  { name: "Inventory", icon: "📦" },
  { name: "Transport", icon: "🚚" },
  { name: "Marketing", icon: "📢" },
  { name: "Repairs", icon: "🔧" },
  { name: "Food & Drinks", icon: "🍽️" },
  { name: "Miscellaneous", icon: "📌" },
];

export const PAYMENT_METHODS = ["cash", "pos", "transfer", "credit"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type DebtorStatus = "open" | "paid" | "partial";

export interface BusinessProfile {
  id: string;
  owner_user_id: string;
  business_name: string;
  business_type: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface SaleRecord {
  id: string;
  business_id: string;
  amount: number;
  item_or_service: string;
  payment_method: string;
  customer_name: string | null;
  staff_id: string | null;
  quantity: number;
  unit_price: number | null;
  sold_at: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  client_id: string | null;
  sync_status: string;
}

export interface ExpenseRecord {
  id: string;
  business_id: string;
  amount: number;
  category: string;
  payment_method: string;
  notes: string | null;
  staff_id: string | null;
  incurred_at: string;
  created_by: string;
  created_at: string;
  client_id: string | null;
  sync_status: string;
}

export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  icon: string;
}

export interface DebtorRecord {
  id: string;
  business_id: string;
  customer_name: string;
  phone: string | null;
  total_amount: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  status: DebtorStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DebtorPayment {
  id: string;
  debtor_id: string;
  amount_paid: number;
  paid_at: string;
  note: string | null;
  created_by: string;
}

export type LedgerKind = "sale" | "expense";

export interface LedgerItem {
  kind: LedgerKind;
  id: string;
  amount: number;
  title: string;
  payment_method: string;
  occurred_at: string;
}

export interface DashboardSummary {
  todaySales: number;
  todayExpenses: number;
  estimatedProfit: number;
  salesCount: number;
  openDebtors: number;
  recentTransactions: LedgerItem[];
}

export type SaleWrite = {
  amount: number;
  item_or_service?: string;
  payment_method?: string;
  customer_name?: string | null;
  quantity?: number;
  unit_price?: number | null;
  sold_at?: string;
  notes?: string | null;
  client_id?: string | null;
};

export type ExpenseWrite = {
  amount: number;
  category?: string;
  payment_method?: string;
  notes?: string | null;
  incurred_at?: string;
  client_id?: string | null;
};

export type DebtorWrite = {
  customer_name: string;
  phone?: string | null;
  total_amount: number;
  amount_paid?: number;
  due_date?: string | null;
  notes?: string | null;
};

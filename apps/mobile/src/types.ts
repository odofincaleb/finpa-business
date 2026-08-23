export const CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
};

export type SubscriptionPeriod = "monthly" | "annual";
export type SyncStatus = "synced" | "pending";
export type PaymentMethod = "cash" | "pos" | "transfer" | "credit";

export interface Profile {
  id: string;
  email: string;
  preferred_currency: CurrencyCode;
  subscription_period: SubscriptionPeriod | null;
  subscription_expires_at: string | null;
  activated_at: string | null;
  created_at: string;
}

export interface BusinessProfile {
  id: string;
  owner_user_id: string;
  business_name: string;
  business_type: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  amount: number;
  item_or_service: string;
  payment_method: string;
  customer_name: string | null;
  quantity: number;
  unit_price: number | null;
  sold_at: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  client_id: string | null;
  sync_status?: SyncStatus;
}

export interface Expense {
  id: string;
  business_id: string;
  amount: number;
  category: string;
  payment_method: string;
  notes: string | null;
  incurred_at: string;
  created_by: string;
  created_at: string;
  client_id: string | null;
  sync_status?: SyncStatus;
}

export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  icon: string;
}

export interface Debtor {
  id: string;
  business_id: string;
  customer_name: string;
  phone: string | null;
  total_amount: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  status: "open" | "paid" | "partial";
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

export interface LedgerItem {
  kind: "sale" | "expense";
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

export interface ChatFeedItem {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export type ReportRange = "daily" | "weekly" | "monthly";

export type DailyReport = {
  date: string;
  sales: {
    total: number;
    count: number;
    byMethod: { cash: number; pos: number; transfer: number; credit: number };
  };
  expenses: { total: number; count: number; byCategory: Record<string, number> };
  profit: number;
  topItems: Array<{ item: string; amount: number }>;
  debtors: { new: number; collected: number; open: number; openTotal: number };
};

export type WeeklyReport = {
  startDate: string;
  endDate: string;
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  dailyBreakdown: Array<{ date: string; sales: number; expenses: number; profit: number }>;
  bestDay: { date: string; sales: number; profit: number };
  avgDailySales: number;
  avgDailyProfit: number;
};

export type MonthlyReport = {
  year: number;
  month: number;
  monthName: string;
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
  weeklyBreakdown: Array<{
    startDate: string;
    endDate: string;
    sales: number;
    expenses: number;
    profit: number;
  }>;
  topExpenseCategories: Array<{ category: string; total: number; pct: number }>;
  topSellingItems: Array<{ item: string; quantity: number; revenue: number }>;
};

export type ExportData = {
  type: ReportRange;
  csv: string;
  shareText: string;
  daily?: DailyReport;
  weekly?: WeeklyReport;
  monthly?: MonthlyReport;
};

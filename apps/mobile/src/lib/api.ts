import type {
  BusinessProfile,
  CurrencyCode,
  DailyReport,
  DashboardSummary,
  Debtor,
  DebtorPayment,
  Expense,
  ExpenseCategory,
  ExportData,
  MonthlyReport,
  Profile,
  ReportRange,
  Sale,
  WeeklyReport,
} from "../types";
import { showDevUi } from "./env";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function networkErrorMessage() {
  if (showDevUi) {
    return `Could not reach FINPA Business server at ${API_URL}. Use your PC LAN IP (not localhost) and keep the backend running.`;
  }
  return "Could not reach FINPA Business servers. Check your internet connection and try again.";
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        // localtunnel browser interstitial bypass for device testing
        "Bypass-Tunnel-Reminder": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        res.status,
        body.code || "INTERNAL",
        body.message || `Request failed (${res.status})`,
      );
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(504, "UPSTREAM_TIMEOUT", "Request timed out. Try again.");
    }
    throw new ApiError(0, "NETWORK", networkErrorMessage());
  } finally {
    clearTimeout(timer);
  }
}

export function getApiUrl() {
  return API_URL;
}

export type AdminPin = {
  code: string;
  period: "monthly" | "annual";
  duration_days: number;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  notes: string;
  created_at: string;
  source?: "admin" | "paystack";
  buyer_email?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  amount_paid?: number | null;
  currency?: "NGN" | "USD" | null;
  paystack_reference?: string | null;
  paystack_status?: string | null;
  sold_at?: string | null;
  email_status?: "pending" | "sent" | "failed" | null;
};

export async function fetchMe(token: string) {
  return request<{
    profile: Profile;
    subscriptionActive: boolean;
    isSuperAdmin?: boolean;
    currencies: CurrencyCode[];
  }>("/api/me", { token });
}

export async function fetchAdminPins(
  token: string,
  opts: {
    status?: "unused" | "redeemed" | "all";
    period?: "monthly" | "annual" | "all";
    q?: string;
    limit?: number;
  } = {},
) {
  const status = opts.status ?? "all";
  const period = opts.period ?? "all";
  const limit = opts.limit ?? 100;
  const q = (opts.q ?? "").trim();
  const params = new URLSearchParams({
    status,
    period,
    limit: String(limit),
  });
  if (q) params.set("q", q);
  return request<{ pins: AdminPin[] }>(`/api/admin/pins?${params}`, { token });
}

export async function generateAdminPins(
  token: string,
  period: "monthly" | "annual",
  count: number,
  notes = "",
) {
  return request<{ pins: AdminPin[] }>("/api/admin/pins/generate", {
    method: "POST",
    token,
    body: JSON.stringify({ period, count, notes }),
  });
}

export async function updateAdminPin(
  token: string,
  code: string,
  patch: {
    period?: "monthly" | "annual";
    duration_days?: number;
    expires_at?: string | null;
    notes?: string;
  },
) {
  return request<{ pin: AdminPin }>(
    `/api/admin/pins/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(patch),
    },
  );
}

export async function revokeAdminPin(token: string, code: string) {
  return request<{ ok: boolean }>(
    `/api/admin/pins/${encodeURIComponent(code)}`,
    { method: "DELETE", token },
  );
}

export async function updateCurrency(token: string, preferred_currency: CurrencyCode) {
  return request<{ profile: Profile; subscriptionActive: boolean }>("/api/me", {
    method: "PATCH",
    token,
    body: JSON.stringify({ preferred_currency }),
  });
}

export async function redeemPin(token: string, code: string) {
  return request<{ profile: Profile; subscriptionActive: boolean; summary: string }>(
    "/api/pins/redeem",
    { method: "POST", token, body: JSON.stringify({ code }) },
  );
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

export async function fetchBusinessProfile(token: string) {
  return request<{ profile: BusinessProfile | null }>("/api/business/profile", { token });
}

export async function createBusinessProfileApi(
  token: string,
  body: { business_name: string; business_type?: string; currency?: string },
) {
  return request<{ profile: BusinessProfile }>("/api/business/profile", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchDashboard(token: string, range: "today" | "weekly" | "monthly" = "today") {
  const path =
    range === "weekly"
      ? "/api/business/dashboard/weekly"
      : range === "monthly"
        ? "/api/business/dashboard/monthly"
        : "/api/business/dashboard";
  return request<DashboardSummary>(path, { token });
}

export async function fetchSales(token: string) {
  return request<{ sales: Sale[] }>("/api/business/sales", { token });
}

export async function createSaleApi(token: string, body: SaleWrite) {
  return request<{ sale: Sale; client_id: string | null }>("/api/business/sales", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchExpenses(token: string) {
  return request<{ expenses: Expense[] }>("/api/business/expenses", { token });
}

export async function createExpenseApi(token: string, body: ExpenseWrite) {
  return request<{ expense: Expense; client_id: string | null }>("/api/business/expenses", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchExpenseCategories(token: string) {
  return request<{ categories: ExpenseCategory[] }>("/api/business/expenses/categories", {
    token,
  });
}

export async function fetchDebtors(token: string, status: "open" | "paid" | "all" = "all") {
  return request<{ debtors: Debtor[] }>(`/api/business/debtors?status=${status}`, { token });
}

export async function createDebtorApi(
  token: string,
  body: {
    customer_name: string;
    phone?: string | null;
    total_amount: number;
    amount_paid?: number;
    due_date?: string | null;
    notes?: string | null;
  },
) {
  return request<{ debtor: Debtor }>("/api/business/debtors", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function fetchDebtorDetail(token: string, id: string) {
  return request<{ debtor: Debtor; payments: DebtorPayment[] }>(
    `/api/business/debtors/${encodeURIComponent(id)}`,
    { token },
  );
}

export async function addDebtorPaymentApi(
  token: string,
  id: string,
  amount: number,
  note?: string,
) {
  return request<{ debtor: Debtor; payment: DebtorPayment }>(
    `/api/business/debtors/${encodeURIComponent(id)}/payments`,
    { method: "POST", token, body: JSON.stringify({ amount, note }) },
  );
}

export async function markDebtorPaidApi(token: string, debtor: Debtor) {
  return request<{ debtor: Debtor }>(
    `/api/business/debtors/${encodeURIComponent(debtor.id)}`,
    {
      method: "PUT",
      token,
      body: JSON.stringify({ amount_paid: debtor.total_amount, status: "paid" }),
    },
  );
}

export type BusinessChatResponse = {
  ok: boolean;
  action: string;
  intent?: string;
  summary: string;
  sale?: Sale | null;
  sales?: Sale[];
  expense?: Expense | null;
  expenses?: Expense[];
  debtor?: Debtor | null;
};

export async function sendBusinessChat(token: string, message: string, categories: string[] = []) {
  return request<BusinessChatResponse>("/api/business/chat", {
    method: "POST",
    token,
    body: JSON.stringify({ message, categories }),
  });
}

function exportQuery(type: ReportRange, date?: string, year?: number, month?: number) {
  const q = new URLSearchParams({ type });
  if (date) q.set("date", date);
  if (year) q.set("year", String(year));
  if (month) q.set("month", String(month));
  return q.toString();
}

export async function fetchDailyReport(token: string, date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<DailyReport>(`/api/business/reports/daily${q}`, { token });
}

export async function fetchWeeklyReport(token: string, end?: string) {
  const q = end ? `?end=${encodeURIComponent(end)}` : "";
  return request<WeeklyReport>(`/api/business/reports/weekly${q}`, { token });
}

export async function fetchMonthlyReport(token: string, year: number, month: number) {
  return request<MonthlyReport>(
    `/api/business/reports/monthly?year=${year}&month=${month}`,
    { token },
  );
}

export async function fetchExportData(
  token: string,
  type: ReportRange,
  date?: string,
  year?: number,
  month?: number,
) {
  return request<ExportData>(`/api/business/export/data?${exportQuery(type, date, year, month)}`, {
    token,
  });
}

export async function fetchExportCsv(
  token: string,
  type: ReportRange,
  date?: string,
  year?: number,
  month?: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${API_URL}/api/business/export/csv?${exportQuery(type, date, year, month)}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Bypass-Tunnel-Reminder": "true",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ApiError(res.status, "INTERNAL", text || `Request failed (${res.status})`);
    }
    return text;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(504, "UPSTREAM_TIMEOUT", "Request timed out. Try again.");
    }
    throw new ApiError(0, "NETWORK", networkErrorMessage());
  } finally {
    clearTimeout(timer);
  }
}

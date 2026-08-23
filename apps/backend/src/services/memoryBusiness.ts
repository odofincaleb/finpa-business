import { randomUUID } from "crypto";
import { AppError } from "../lib/errors";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  type BusinessProfile,
  type DashboardSummary,
  type DebtorPayment,
  type DebtorRecord,
  type DebtorStatus,
  type DebtorWrite,
  type ExpenseCategory,
  type ExpenseRecord,
  type ExpenseWrite,
  type LedgerItem,
  type SaleRecord,
  type SaleWrite,
} from "../types/business";

const businesses = new Map<string, BusinessProfile>();
const sales = new Map<string, SaleRecord[]>();
const expenses = new Map<string, ExpenseRecord[]>();
const categories = new Map<string, ExpenseCategory[]>();
const debtors = new Map<string, DebtorRecord[]>();
const payments = new Map<string, DebtorPayment[]>();

export function memoryResetBusiness() {
  businesses.clear();
  sales.clear();
  expenses.clear();
  categories.clear();
  debtors.clear();
  payments.clear();
}

function seedCats(businessId: string) {
  categories.set(
    businessId,
    DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      id: randomUUID(),
      business_id: businessId,
      name: c.name,
      icon: c.icon,
    })),
  );
}

export function memoryGetBusinessForOwner(userId: string): BusinessProfile | null {
  return [...businesses.values()].find((b) => b.owner_user_id === userId) ?? null;
}

export function memoryRequireBusiness(userId: string): BusinessProfile {
  const biz = memoryGetBusinessForOwner(userId);
  if (!biz) throw new AppError(404, "NOT_FOUND", "Create a business profile first");
  return biz;
}

export function memoryCreateBusiness(
  userId: string,
  input: { business_name: string; business_type?: string | null; currency?: string },
): BusinessProfile {
  const existing = memoryGetBusinessForOwner(userId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const biz: BusinessProfile = {
    id: randomUUID(),
    owner_user_id: userId,
    business_name: input.business_name.trim(),
    business_type: input.business_type ?? null,
    currency: input.currency || "NGN",
    created_at: now,
    updated_at: now,
  };
  businesses.set(biz.id, biz);
  sales.set(biz.id, []);
  expenses.set(biz.id, []);
  debtors.set(biz.id, []);
  seedCats(biz.id);
  return biz;
}

export function memoryUpdateBusiness(
  userId: string,
  patch: { business_name?: string; business_type?: string | null; currency?: string },
): BusinessProfile {
  const biz = memoryRequireBusiness(userId);
  const next: BusinessProfile = {
    ...biz,
    business_name: patch.business_name?.trim() || biz.business_name,
    business_type: patch.business_type !== undefined ? patch.business_type : biz.business_type,
    currency: patch.currency || biz.currency,
    updated_at: new Date().toISOString(),
  };
  businesses.set(biz.id, next);
  return next;
}

export function memoryCreateSale(userId: string, input: SaleWrite): SaleRecord {
  const biz = memoryRequireBusiness(userId);
  const now = new Date().toISOString();
  const row: SaleRecord = {
    id: randomUUID(),
    business_id: biz.id,
    amount: input.amount,
    item_or_service: input.item_or_service ?? "",
    payment_method: input.payment_method || "cash",
    customer_name: input.customer_name ?? null,
    staff_id: null,
    quantity: input.quantity ?? 1,
    unit_price: input.unit_price ?? null,
    sold_at: input.sold_at ?? now,
    notes: input.notes ?? null,
    created_by: userId,
    created_at: now,
    client_id: input.client_id ?? null,
    sync_status: "synced",
  };
  sales.set(biz.id, [row, ...(sales.get(biz.id) ?? [])]);
  return row;
}

export function memoryListSales(
  userId: string,
  opts: { from?: string; to?: string; limit?: number; offset?: number } = {},
): SaleRecord[] {
  const biz = memoryRequireBusiness(userId);
  let rows = sales.get(biz.id) ?? [];
  if (opts.from) rows = rows.filter((r) => r.sold_at >= opts.from!);
  if (opts.to) rows = rows.filter((r) => r.sold_at <= opts.to!);
  const offset = opts.offset ?? 0;
  return rows.slice(offset, offset + (opts.limit ?? 100));
}

export function memoryGetSale(userId: string, id: string): SaleRecord {
  const biz = memoryRequireBusiness(userId);
  const row = (sales.get(biz.id) ?? []).find((s) => s.id === id);
  if (!row) throw new AppError(404, "NOT_FOUND", "Sale not found");
  return row;
}

export function memoryUpdateSale(userId: string, id: string, patch: Partial<SaleWrite>): SaleRecord {
  const current = memoryGetSale(userId, id);
  const next: SaleRecord = {
    ...current,
    amount: patch.amount ?? current.amount,
    item_or_service: patch.item_or_service ?? current.item_or_service,
    payment_method: patch.payment_method ?? current.payment_method,
    customer_name: patch.customer_name !== undefined ? patch.customer_name : current.customer_name,
    quantity: patch.quantity ?? current.quantity,
    unit_price: patch.unit_price !== undefined ? patch.unit_price : current.unit_price,
    sold_at: patch.sold_at ?? current.sold_at,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
  };
  sales.set(
    current.business_id,
    (sales.get(current.business_id) ?? []).map((s) => (s.id === id ? next : s)),
  );
  return next;
}

export function memoryDeleteSale(userId: string, id: string): void {
  const current = memoryGetSale(userId, id);
  sales.set(
    current.business_id,
    (sales.get(current.business_id) ?? []).filter((s) => s.id !== id),
  );
}

export function memoryCreateExpense(userId: string, input: ExpenseWrite): ExpenseRecord {
  const biz = memoryRequireBusiness(userId);
  const now = new Date().toISOString();
  const row: ExpenseRecord = {
    id: randomUUID(),
    business_id: biz.id,
    amount: input.amount,
    category: input.category || "general",
    payment_method: input.payment_method || "cash",
    notes: input.notes ?? null,
    staff_id: null,
    incurred_at: input.incurred_at ?? now,
    created_by: userId,
    created_at: now,
    client_id: input.client_id ?? null,
    sync_status: "synced",
  };
  expenses.set(biz.id, [row, ...(expenses.get(biz.id) ?? [])]);
  return row;
}

export function memoryListExpenses(
  userId: string,
  opts: { from?: string; to?: string; category?: string; limit?: number } = {},
): ExpenseRecord[] {
  const biz = memoryRequireBusiness(userId);
  let rows = expenses.get(biz.id) ?? [];
  if (opts.from) rows = rows.filter((r) => r.incurred_at >= opts.from!);
  if (opts.to) rows = rows.filter((r) => r.incurred_at <= opts.to!);
  if (opts.category) rows = rows.filter((r) => r.category === opts.category);
  return rows.slice(0, opts.limit ?? 100);
}

export function memoryGetExpense(userId: string, id: string): ExpenseRecord {
  const biz = memoryRequireBusiness(userId);
  const row = (expenses.get(biz.id) ?? []).find((s) => s.id === id);
  if (!row) throw new AppError(404, "NOT_FOUND", "Expense not found");
  return row;
}

export function memoryUpdateExpense(
  userId: string,
  id: string,
  patch: Partial<ExpenseWrite>,
): ExpenseRecord {
  const current = memoryGetExpense(userId, id);
  const next: ExpenseRecord = {
    ...current,
    amount: patch.amount ?? current.amount,
    category: patch.category ?? current.category,
    payment_method: patch.payment_method ?? current.payment_method,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    incurred_at: patch.incurred_at ?? current.incurred_at,
  };
  expenses.set(
    current.business_id,
    (expenses.get(current.business_id) ?? []).map((s) => (s.id === id ? next : s)),
  );
  return next;
}

export function memoryDeleteExpense(userId: string, id: string): void {
  const current = memoryGetExpense(userId, id);
  expenses.set(
    current.business_id,
    (expenses.get(current.business_id) ?? []).filter((s) => s.id !== id),
  );
}

export function memoryListExpenseCategories(userId: string): ExpenseCategory[] {
  const biz = memoryRequireBusiness(userId);
  return categories.get(biz.id) ?? [];
}

function debtorStatus(total: number, paid: number): DebtorStatus {
  if (paid <= 0) return "open";
  if (paid >= total) return "paid";
  return "partial";
}

export function memoryCreateDebtor(userId: string, input: DebtorWrite): DebtorRecord {
  const biz = memoryRequireBusiness(userId);
  const now = new Date().toISOString();
  const paid = input.amount_paid ?? 0;
  const row: DebtorRecord = {
    id: randomUUID(),
    business_id: biz.id,
    customer_name: input.customer_name.trim(),
    phone: input.phone ?? null,
    total_amount: input.total_amount,
    amount_paid: paid,
    balance: input.total_amount - paid,
    due_date: input.due_date ?? null,
    status: debtorStatus(input.total_amount, paid),
    notes: input.notes ?? null,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
  debtors.set(biz.id, [row, ...(debtors.get(biz.id) ?? [])]);
  return row;
}

export function memoryListDebtors(userId: string, status?: "open" | "paid" | "all"): DebtorRecord[] {
  const biz = memoryRequireBusiness(userId);
  let rows = debtors.get(biz.id) ?? [];
  if (status && status !== "all") rows = rows.filter((d) => d.status === status);
  return rows;
}

export function memoryGetDebtor(userId: string, id: string): DebtorRecord {
  const biz = memoryRequireBusiness(userId);
  const row = (debtors.get(biz.id) ?? []).find((d) => d.id === id);
  if (!row) throw new AppError(404, "NOT_FOUND", "Debtor not found");
  return row;
}

export function memoryListDebtorPayments(debtorId: string): DebtorPayment[] {
  return payments.get(debtorId) ?? [];
}

export function memoryUpdateDebtor(
  userId: string,
  id: string,
  patch: Partial<DebtorWrite> & { status?: DebtorStatus },
): DebtorRecord {
  const current = memoryGetDebtor(userId, id);
  const total = patch.total_amount ?? current.total_amount;
  const paid = patch.amount_paid ?? current.amount_paid;
  const next: DebtorRecord = {
    ...current,
    customer_name: patch.customer_name ?? current.customer_name,
    phone: patch.phone !== undefined ? patch.phone : current.phone,
    total_amount: total,
    amount_paid: paid,
    balance: total - paid,
    due_date: patch.due_date !== undefined ? patch.due_date : current.due_date,
    status: patch.status ?? debtorStatus(total, paid),
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    updated_at: new Date().toISOString(),
  };
  debtors.set(
    current.business_id,
    (debtors.get(current.business_id) ?? []).map((d) => (d.id === id ? next : d)),
  );
  return next;
}

export function memoryAddDebtorPayment(
  userId: string,
  id: string,
  amount: number,
  note?: string | null,
): { debtor: DebtorRecord; payment: DebtorPayment } {
  const current = memoryGetDebtor(userId, id);
  const payment: DebtorPayment = {
    id: randomUUID(),
    debtor_id: id,
    amount_paid: amount,
    paid_at: new Date().toISOString(),
    note: note ?? null,
    created_by: userId,
  };
  payments.set(id, [payment, ...(payments.get(id) ?? [])]);
  const debtor = memoryUpdateDebtor(userId, id, { amount_paid: current.amount_paid + amount });
  return { debtor, payment };
}

export function memoryDeleteDebtor(userId: string, id: string): void {
  const current = memoryGetDebtor(userId, id);
  debtors.set(
    current.business_id,
    (debtors.get(current.business_id) ?? []).filter((d) => d.id !== id),
  );
  payments.delete(id);
}

export function memoryLoadReportData(userId: string): {
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  debtors: DebtorRecord[];
  payments: DebtorPayment[];
} {
  const biz = memoryGetBusinessForOwner(userId);
  if (!biz) return { sales: [], expenses: [], debtors: [], payments: [] };
  const bizDebtors = debtors.get(biz.id) ?? [];
  return {
    sales: sales.get(biz.id) ?? [],
    expenses: expenses.get(biz.id) ?? [],
    debtors: bizDebtors,
    payments: bizDebtors.flatMap((d) => payments.get(d.id) ?? []),
  };
}

export function memoryDashboard(
  userId: string,
  range: "today" | "weekly" | "monthly",
): DashboardSummary {
  const biz = memoryGetBusinessForOwner(userId);
  if (!biz) {
    return {
      todaySales: 0,
      todayExpenses: 0,
      estimatedProfit: 0,
      salesCount: 0,
      openDebtors: 0,
      recentTransactions: [],
    };
  }
  const ms = range === "today" ? 0 : range === "weekly" ? 7 : 30;
  const from =
    range === "today"
      ? new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
      : new Date(Date.now() - ms * 86400000).toISOString();
  const saleRows = (sales.get(biz.id) ?? []).filter((s) => s.sold_at >= from);
  const expRows = (expenses.get(biz.id) ?? []).filter((e) => e.incurred_at >= from);
  const todaySales = saleRows.reduce((a, s) => a + s.amount, 0);
  const todayExpenses = expRows.reduce((a, s) => a + s.amount, 0);
  const recent: LedgerItem[] = [
    ...(sales.get(biz.id) ?? []).map((s) => ({
      kind: "sale" as const,
      id: s.id,
      amount: s.amount,
      title: s.item_or_service || "Sale",
      payment_method: s.payment_method,
      occurred_at: s.sold_at,
    })),
    ...(expenses.get(biz.id) ?? []).map((e) => ({
      kind: "expense" as const,
      id: e.id,
      amount: e.amount,
      title: e.category || "Expense",
      payment_method: e.payment_method,
      occurred_at: e.incurred_at,
    })),
  ]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 10);
  return {
    todaySales,
    todayExpenses,
    estimatedProfit: todaySales - todayExpenses,
    salesCount: saleRows.length,
    openDebtors: (debtors.get(biz.id) ?? []).filter((d) => d.status !== "paid").length,
    recentTransactions: recent,
  };
}

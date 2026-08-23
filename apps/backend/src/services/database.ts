import { hasDatabase } from "../lib/pg";
import { AppError } from "../lib/errors";
import type { Profile, SubscriptionPeriod } from "../types/transaction";
import type { AdminPin, PinSale } from "../types/pins";
import type {
  BusinessProfile,
  DashboardSummary,
  DebtorPayment,
  DebtorRecord,
  DebtorStatus,
  DebtorWrite,
  ExpenseCategory,
  ExpenseRecord,
  ExpenseWrite,
  SaleRecord,
  SaleWrite,
} from "../types/business";
import {
  memoryCreatePinSale,
  memoryCreatePins,
  memoryDeletePin,
  memoryGetPin,
  memoryGetPinSaleByReference,
  memoryGetProfile,
  memoryListPins,
  memoryRedeemPin,
  memoryUpdatePin,
  memoryUpdatePinSaleEmailStatus,
  memoryUpdateProfile,
  type MemoryPin,
  type MemoryPinSale,
} from "./memoryStore";
import {
  memoryAddDebtorPayment,
  memoryCreateBusiness,
  memoryCreateDebtor,
  memoryCreateExpense,
  memoryCreateSale,
  memoryDashboard,
  memoryDeleteDebtor,
  memoryDeleteExpense,
  memoryDeleteSale,
  memoryGetBusinessForOwner,
  memoryGetDebtor,
  memoryGetExpense,
  memoryGetSale,
  memoryListDebtorPayments,
  memoryListDebtors,
  memoryListExpenseCategories,
  memoryListExpenses,
  memoryListSales,
  memoryUpdateBusiness,
  memoryUpdateDebtor,
  memoryUpdateExpense,
  memoryUpdateSale,
} from "./memoryBusiness";
import * as pg from "./pgStore";

export type { AdminPin, PinSale };

function mapMemoryPin(p: MemoryPin): AdminPin {
  return {
    code: p.code,
    period: p.period,
    duration_days: p.duration_days,
    redeemed_by: p.redeemed_by,
    redeemed_at: p.redeemed_at,
    expires_at: p.expires_at,
    notes: p.notes,
    created_at: p.created_at,
    source: p.source ?? "admin",
    buyer_email: p.buyer_email ?? null,
    buyer_name: p.buyer_name ?? null,
    buyer_phone: p.buyer_phone ?? null,
    amount_paid: p.amount_paid ?? null,
    currency: p.currency ?? null,
    paystack_reference: p.paystack_reference ?? null,
    paystack_status: p.paystack_status ?? null,
    sold_at: p.sold_at ?? null,
    email_status: p.email_status ?? null,
  };
}

export async function getProfile(userId: string, email: string): Promise<Profile> {
  if (hasDatabase()) return pg.pgGetProfile(userId, email);
  return memoryGetProfile(userId, email);
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "preferred_currency" | "email">>,
): Promise<Profile> {
  if (hasDatabase()) return pg.pgUpdateProfile(userId, patch);
  return memoryUpdateProfile(userId, patch);
}

export async function generatePins(
  period: SubscriptionPeriod,
  count: number,
  notes = "",
): Promise<AdminPin[]> {
  if (hasDatabase()) return pg.pgGeneratePins(period, count, notes);
  return memoryCreatePins(period, count, notes).map(mapMemoryPin);
}

export async function listPins(
  status: "unused" | "redeemed" | "all" = "all",
  limit = 100,
  search = "",
  period: "monthly" | "annual" | "all" = "all",
): Promise<AdminPin[]> {
  if (hasDatabase()) return pg.pgListPins(status, limit, search, period);
  return memoryListPins(status, limit, search, period).map(mapMemoryPin);
}

export async function getPin(code: string): Promise<AdminPin | null> {
  if (hasDatabase()) return pg.pgGetPin(code);
  const p = memoryGetPin(code);
  return p ? mapMemoryPin(p) : null;
}

export async function getPaystackPinSaleByReference(reference: string): Promise<PinSale | null> {
  if (hasDatabase()) return pg.pgGetPinSaleByReference(reference);
  const sale = memoryGetPinSaleByReference(reference);
  return sale ? { ...sale } : null;
}

export async function createPaystackPinSale(input: Omit<PinSale, "id" | "pin_code">): Promise<PinSale> {
  const existing = await getPaystackPinSaleByReference(input.paystack_reference);
  if (existing) return existing;
  if (hasDatabase()) return pg.pgCreatePinSale(input);
  return memoryCreatePinSale(input) as MemoryPinSale;
}

export async function updatePaystackPinSaleEmailStatus(
  reference: string,
  email_status: "pending" | "sent" | "failed",
): Promise<void> {
  if (hasDatabase()) return pg.pgUpdatePinSaleEmailStatus(reference, email_status);
  memoryUpdatePinSaleEmailStatus(reference, email_status);
}

export async function updatePin(
  code: string,
  patch: {
    period?: SubscriptionPeriod;
    duration_days?: number;
    expires_at?: string | null;
    notes?: string;
  },
): Promise<AdminPin> {
  if (hasDatabase()) return pg.pgUpdatePin(code, patch);
  try {
    return mapMemoryPin(memoryUpdatePin(code, patch));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") throw new AppError(404, "NOT_FOUND", "PIN not found");
    if (msg === "REDEEMED") {
      throw new AppError(400, "PIN_REDEEMED", "Cannot edit a redeemed PIN");
    }
    throw e;
  }
}

export async function deletePin(code: string): Promise<void> {
  if (hasDatabase()) return pg.pgDeletePin(code);
  try {
    memoryDeletePin(code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") throw new AppError(404, "NOT_FOUND", "PIN not found");
    if (msg === "REDEEMED") {
      throw new AppError(400, "PIN_REDEEMED", "Cannot delete a redeemed PIN");
    }
    throw e;
  }
}

export async function redeemPin(userId: string, code: string): Promise<Profile> {
  if (hasDatabase()) return pg.pgRedeemPin(userId, code);
  try {
    return memoryRedeemPin(userId, code);
  } catch {
    throw new AppError(400, "PIN_INVALID", "Invalid or already used PIN");
  }
}

export function isSubscriptionActive(profile: Profile): boolean {
  if (!profile.subscription_expires_at) return false;
  return new Date(profile.subscription_expires_at).getTime() > Date.now();
}

export async function getBusinessProfile(userId: string): Promise<BusinessProfile | null> {
  if (hasDatabase()) return pg.pgGetBusinessForOwner(userId);
  return memoryGetBusinessForOwner(userId);
}

export async function createBusinessProfile(
  userId: string,
  input: { business_name: string; business_type?: string | null; currency?: string },
): Promise<BusinessProfile> {
  if (hasDatabase()) return pg.pgCreateBusiness(userId, input);
  return memoryCreateBusiness(userId, input);
}

export async function updateBusinessProfile(
  userId: string,
  patch: { business_name?: string; business_type?: string | null; currency?: string },
): Promise<BusinessProfile> {
  if (hasDatabase()) return pg.pgUpdateBusiness(userId, patch);
  return memoryUpdateBusiness(userId, patch);
}

export async function createSale(userId: string, input: SaleWrite): Promise<SaleRecord> {
  if (hasDatabase()) return pg.pgCreateSale(userId, input);
  return memoryCreateSale(userId, input);
}

export async function listSales(
  userId: string,
  opts: { from?: string; to?: string; limit?: number; offset?: number } = {},
): Promise<SaleRecord[]> {
  if (hasDatabase()) return pg.pgListSales(userId, opts);
  return memoryListSales(userId, opts);
}

export async function getSale(userId: string, id: string): Promise<SaleRecord> {
  if (hasDatabase()) return pg.pgGetSale(userId, id);
  return memoryGetSale(userId, id);
}

export async function updateSale(
  userId: string,
  id: string,
  patch: Partial<SaleWrite>,
): Promise<SaleRecord> {
  if (hasDatabase()) return pg.pgUpdateSale(userId, id, patch);
  return memoryUpdateSale(userId, id, patch);
}

export async function deleteSale(userId: string, id: string): Promise<void> {
  if (hasDatabase()) return pg.pgDeleteSale(userId, id);
  return memoryDeleteSale(userId, id);
}

export async function createExpense(userId: string, input: ExpenseWrite): Promise<ExpenseRecord> {
  if (hasDatabase()) return pg.pgCreateExpense(userId, input);
  return memoryCreateExpense(userId, input);
}

export async function listExpenses(
  userId: string,
  opts: { from?: string; to?: string; category?: string; limit?: number } = {},
): Promise<ExpenseRecord[]> {
  if (hasDatabase()) return pg.pgListExpenses(userId, opts);
  return memoryListExpenses(userId, opts);
}

export async function getExpense(userId: string, id: string): Promise<ExpenseRecord> {
  if (hasDatabase()) return pg.pgGetExpense(userId, id);
  return memoryGetExpense(userId, id);
}

export async function updateExpense(
  userId: string,
  id: string,
  patch: Partial<ExpenseWrite>,
): Promise<ExpenseRecord> {
  if (hasDatabase()) return pg.pgUpdateExpense(userId, id, patch);
  return memoryUpdateExpense(userId, id, patch);
}

export async function deleteExpense(userId: string, id: string): Promise<void> {
  if (hasDatabase()) return pg.pgDeleteExpense(userId, id);
  return memoryDeleteExpense(userId, id);
}

export async function listExpenseCategories(userId: string): Promise<ExpenseCategory[]> {
  if (hasDatabase()) return pg.pgListExpenseCategories(userId);
  return memoryListExpenseCategories(userId);
}

export async function createDebtor(userId: string, input: DebtorWrite): Promise<DebtorRecord> {
  if (hasDatabase()) return pg.pgCreateDebtor(userId, input);
  return memoryCreateDebtor(userId, input);
}

export async function listDebtors(
  userId: string,
  status?: "open" | "paid" | "all",
): Promise<DebtorRecord[]> {
  if (hasDatabase()) return pg.pgListDebtors(userId, status);
  return memoryListDebtors(userId, status);
}

export async function getDebtorWithPayments(
  userId: string,
  id: string,
): Promise<{ debtor: DebtorRecord; payments: DebtorPayment[] }> {
  const debtor = hasDatabase() ? await pg.pgGetDebtor(userId, id) : memoryGetDebtor(userId, id);
  const pays = hasDatabase()
    ? await pg.pgListDebtorPayments(id)
    : memoryListDebtorPayments(id);
  return { debtor, payments: pays };
}

export async function updateDebtor(
  userId: string,
  id: string,
  patch: Partial<DebtorWrite> & { status?: DebtorStatus },
): Promise<DebtorRecord> {
  if (hasDatabase()) return pg.pgUpdateDebtor(userId, id, patch);
  return memoryUpdateDebtor(userId, id, patch);
}

export async function addDebtorPayment(
  userId: string,
  id: string,
  amount: number,
  note?: string | null,
) {
  if (hasDatabase()) return pg.pgAddDebtorPayment(userId, id, amount, note);
  return memoryAddDebtorPayment(userId, id, amount, note);
}

export async function deleteDebtor(userId: string, id: string): Promise<void> {
  if (hasDatabase()) return pg.pgDeleteDebtor(userId, id);
  return memoryDeleteDebtor(userId, id);
}

export async function getDashboard(
  userId: string,
  range: "today" | "weekly" | "monthly" = "today",
): Promise<DashboardSummary> {
  if (hasDatabase()) return pg.pgDashboard(userId, range);
  return memoryDashboard(userId, range);
}

export type { CurrencyCode } from "../types/transaction";

import { randomUUID } from "crypto";
import { memoryResetBusiness } from "./memoryBusiness";
import { findMatchingTransaction } from "../lib/matchTransaction";
import {
  allowDemoPins,
  DEMO_PIN_CODE,
  generateActivationCode,
  isDemoPinCode,
} from "../lib/securePin";
import type {
  Category,
  MonthlyBudget,
  Profile,
  SubscriptionPeriod,
  TransactionExtract,
  TransactionRecord,
} from "../types/transaction";

const profiles = new Map<string, Profile>();
const transactions = new Map<string, TransactionRecord[]>();
const budgets = new Map<string, MonthlyBudget[]>();
export type MemoryPin = {
  code: string;
  period: SubscriptionPeriod;
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

export type MemoryPinSale = {
  id: string;
  pin_code: string;
  plan_id: string;
  period: SubscriptionPeriod;
  duration_days: number;
  buyer_email: string;
  buyer_name: string;
  buyer_phone: string;
  amount_paid: number;
  currency: "NGN" | "USD";
  paystack_reference: string;
  paystack_status: string;
  source: "paystack";
  sold_at: string;
  email_status: "pending" | "sent" | "failed";
  metadata: Record<string, unknown>;
};

const pins = new Map<string, MemoryPin>();
const pinSales = new Map<string, MemoryPinSale>();

export function memoryGetProfile(userId: string, email: string): Profile {
  let profile = profiles.get(userId);
  if (!profile) {
    profile = {
      id: userId,
      email,
      preferred_currency: "NGN",
      subscription_period: null,
      subscription_expires_at: null,
      activated_at: null,
      created_at: new Date().toISOString(),
    };
    profiles.set(userId, profile);
  }
  return profile;
}

export function memoryUpdateProfile(
  userId: string,
  patch: Partial<Profile>,
): Profile {
  const current = memoryGetProfile(userId, patch.email ?? "dev@finpa.app");
  const next = { ...current, ...patch, id: userId };
  profiles.set(userId, next);
  return next;
}

export function memoryListTransactions(userId: string, limit = 50): TransactionRecord[] {
  const rows = transactions.get(userId) ?? [];
  return [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function memoryInsertTransactions(
  userId: string,
  items: TransactionExtract[],
): TransactionRecord[] {
  const existing = transactions.get(userId) ?? [];
  const created = items.map((item) => ({
    ...item,
    id: randomUUID(),
    user_id: userId,
    created_at: new Date().toISOString(),
  }));
  transactions.set(userId, [...created, ...existing]);
  return created;
}

export function memoryUpdateTransaction(
  userId: string,
  match: string,
  fields: Partial<TransactionExtract>,
  message?: string,
): TransactionRecord | null {
  const rows = transactions.get(userId) ?? [];
  const target = findMatchingTransaction(rows, match, message);
  if (!target) return null;
  const idx = rows.findIndex((r) => r.id === target.id);
  if (idx < 0) return null;
  rows[idx] = { ...rows[idx], ...fields };
  transactions.set(userId, rows);
  return rows[idx];
}

export function memoryUpdateTransactionById(
  userId: string,
  id: string,
  fields: Partial<TransactionExtract> & { created_at?: string },
): TransactionRecord | null {
  const rows = transactions.get(userId) ?? [];
  const idx = rows.findIndex((r) => r.id === id && r.user_id === userId);
  if (idx < 0) return null;
  rows[idx] = { ...rows[idx], ...fields };
  transactions.set(userId, rows);
  return rows[idx];
}

export function memoryDeleteTransaction(
  userId: string,
  id: string,
): boolean {
  const rows = transactions.get(userId) ?? [];
  const next = rows.filter((r) => !(r.id === id && r.user_id === userId));
  if (next.length === rows.length) return false;
  transactions.set(userId, next);
  return true;
}

function budgetKey(userId: string, year: number, month: number) {
  return `${userId}:${year}:${month}`;
}

export function memoryGetBudgets(
  userId: string,
  year: number,
  month: number,
): MonthlyBudget[] {
  return budgets.get(budgetKey(userId, year, month)) ?? [];
}

export function memoryUpsertBudgets(
  userId: string,
  year: number,
  month: number,
  currency: string,
  items: { category: string; budget_amount: number }[],
): MonthlyBudget[] {
  const key = budgetKey(userId, year, month);
  const existing = budgets.get(key) ?? [];
  const map = new Map(existing.map((b) => [b.category, b]));

  for (const item of items) {
    const prev = map.get(item.category);
    map.set(item.category, {
      id: prev?.id ?? randomUUID(),
      user_id: userId,
      year,
      month,
      category: item.category,
      budget_amount: item.budget_amount,
      currency,
    });
  }

  const next = Array.from(map.values());
  budgets.set(key, next);
  return next;
}

export function memoryCreatePins(
  period: SubscriptionPeriod,
  count: number,
  notes = "",
): MemoryPin[] {
  const duration_days = period === "annual" ? 365 : 30;
  const created: MemoryPin[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateActivationCode();
    const row: MemoryPin = {
      code,
      period,
      duration_days,
      redeemed_by: null,
      redeemed_at: null,
      expires_at: null,
      notes: notes.trim(),
      created_at: new Date().toISOString(),
    };
    pins.set(code, row);
    created.push(row);
  }
  return created;
}

export function memoryListPins(
  status: "unused" | "redeemed" | "all" = "all",
  limit = 100,
  q = "",
  period?: "monthly" | "annual" | "all",
): MemoryPin[] {
  let rows = Array.from(pins.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  if (status === "unused") rows = rows.filter((p) => !p.redeemed_by);
  if (status === "redeemed") rows = rows.filter((p) => Boolean(p.redeemed_by));
  if (period === "monthly" || period === "annual") {
    rows = rows.filter((p) => p.period === period);
  }
  const needle = q.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (p) =>
        p.code.toLowerCase().includes(needle) ||
        p.notes.toLowerCase().includes(needle),
    );
  }
  return rows.slice(0, Math.min(Math.max(limit, 1), 200));
}

export function memoryGetPin(code: string): MemoryPin | null {
  return pins.get(code.trim().toUpperCase()) ?? null;
}

export function memoryGetPinSaleByReference(reference: string): MemoryPinSale | null {
  return pinSales.get(reference.trim()) ?? null;
}

export function memoryUpdatePinSaleEmailStatus(
  reference: string,
  email_status: "pending" | "sent" | "failed",
): void {
  const key = reference.trim();
  const sale = pinSales.get(key);
  if (!sale) return;
  sale.email_status = email_status;
  const pin = pins.get(sale.pin_code);
  if (pin) pin.email_status = email_status;
}

export function memoryCreatePinSale(input: Omit<MemoryPinSale, "id" | "pin_code">): MemoryPinSale {
  const existing = memoryGetPinSaleByReference(input.paystack_reference || "");
  if (existing) return existing;
  const code = generateActivationCode();
  const sale: MemoryPinSale = {
    ...input,
    id: randomUUID(),
    pin_code: code,
  };
  const pin: MemoryPin = {
    code,
    period: input.period,
    duration_days: input.duration_days,
    redeemed_by: null,
    redeemed_at: null,
    expires_at: null,
    notes: `Paystack sale ${input.paystack_reference} ${input.buyer_email}`.trim(),
    created_at: sale.sold_at,
    source: "paystack",
    buyer_email: input.buyer_email,
    buyer_name: input.buyer_name,
    buyer_phone: input.buyer_phone,
    amount_paid: input.amount_paid,
    currency: input.currency,
    paystack_reference: input.paystack_reference,
    paystack_status: input.paystack_status,
    sold_at: input.sold_at,
    email_status: input.email_status,
  };
  pins.set(code, pin);
  pinSales.set(input.paystack_reference, sale);
  return sale;
}

export function memoryUpdatePin(
  code: string,
  patch: Partial<
    Pick<MemoryPin, "period" | "duration_days" | "expires_at" | "notes">
  >,
): MemoryPin {
  const key = code.trim().toUpperCase();
  const pin = pins.get(key);
  if (!pin) throw new Error("NOT_FOUND");
  if (pin.redeemed_by) throw new Error("REDEEMED");
  if (patch.period) {
    pin.period = patch.period;
    if (patch.duration_days == null) {
      pin.duration_days = patch.period === "annual" ? 365 : 30;
    }
  }
  if (patch.duration_days != null) pin.duration_days = patch.duration_days;
  if (patch.expires_at !== undefined) pin.expires_at = patch.expires_at;
  if (patch.notes !== undefined) pin.notes = patch.notes;
  pins.set(key, pin);
  return pin;
}

export function memoryDeletePin(code: string): void {
  const key = code.trim().toUpperCase();
  const pin = pins.get(key);
  if (!pin) throw new Error("NOT_FOUND");
  if (pin.redeemed_by) throw new Error("REDEEMED");
  pins.delete(key);
}

/** Seed a known demo PIN for local Expo Go review (memory mode only). */
export function memorySeedDemoPin() {
  if (!allowDemoPins()) return;
  if (!pins.has(DEMO_PIN_CODE)) {
    pins.set(DEMO_PIN_CODE, {
      code: DEMO_PIN_CODE,
      period: "monthly",
      duration_days: 30,
      redeemed_by: null,
      redeemed_at: null,
      expires_at: null,
      notes: "Demo",
      created_at: new Date().toISOString(),
    });
  }
}

export function memoryRedeemPin(userId: string, code: string): Profile {
  const normalized = code.trim().toUpperCase();
  const pin = pins.get(normalized);
  const isDemo = isDemoPinCode(normalized);
  if (isDemo && !allowDemoPins()) {
    throw new Error("PIN_INVALID");
  }
  if (!pin || (!isDemo && pin.redeemed_by)) {
    throw new Error("PIN_INVALID");
  }
  if (pin.expires_at && new Date(pin.expires_at).getTime() < Date.now()) {
    throw new Error("PIN_INVALID");
  }

  const profile = memoryGetProfile(userId, "");
  const base = Math.max(
    Date.now(),
    profile.subscription_expires_at
      ? new Date(profile.subscription_expires_at).getTime()
      : 0,
  );
  const expires = new Date(base + pin.duration_days * 24 * 60 * 60 * 1000).toISOString();

  if (!isDemo) {
    pin.redeemed_by = userId;
    pin.redeemed_at = new Date().toISOString();
  }

  return memoryUpdateProfile(userId, {
    subscription_period: pin.period,
    subscription_expires_at: expires,
    activated_at: profile.activated_at ?? new Date().toISOString(),
  });
}

export function memoryResetForTests() {
  profiles.clear();
  transactions.clear();
  budgets.clear();
  pins.clear();
  pinSales.clear();
  memoryResetBusiness();
}

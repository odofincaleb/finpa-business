import { getPool } from "../lib/pg";
import { AppError } from "../lib/errors";
import {
  allowDemoPins,
  generateActivationCode,
  isDemoPinCode,
} from "../lib/securePin";
import type { Profile, SubscriptionPeriod } from "../types/transaction";
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
import type { AdminPin, PinSale } from "../types/pins";

function iso(v: unknown, fallback?: string): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) return v;
  return fallback ?? new Date().toISOString();
}

function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) return v;
  return null;
}

function num(v: unknown): number {
  return Number(v ?? 0);
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    preferred_currency: (row.preferred_currency as Profile["preferred_currency"]) || "NGN",
    subscription_period: (row.subscription_period as SubscriptionPeriod | null) ?? null,
    subscription_expires_at: isoOrNull(row.subscription_expires_at),
    activated_at: isoOrNull(row.activated_at),
    created_at: iso(row.created_at),
  };
}

function mapBusiness(row: Record<string, unknown>): BusinessProfile {
  return {
    id: String(row.id),
    owner_user_id: String(row.owner_user_id),
    business_name: String(row.business_name),
    business_type: row.business_type != null ? String(row.business_type) : null,
    currency: String(row.currency ?? "NGN"),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapSale(row: Record<string, unknown>): SaleRecord {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    amount: num(row.amount),
    item_or_service: String(row.item_or_service ?? ""),
    payment_method: String(row.payment_method ?? "cash"),
    customer_name: row.customer_name != null ? String(row.customer_name) : null,
    staff_id: row.staff_id != null ? String(row.staff_id) : null,
    quantity: Number(row.quantity ?? 1),
    unit_price: row.unit_price != null ? num(row.unit_price) : null,
    sold_at: iso(row.sold_at),
    notes: row.notes != null ? String(row.notes) : null,
    created_by: String(row.created_by),
    created_at: iso(row.created_at),
    client_id: row.client_id != null ? String(row.client_id) : null,
    sync_status: String(row.sync_status ?? "synced"),
  };
}

function mapExpense(row: Record<string, unknown>): ExpenseRecord {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    amount: num(row.amount),
    category: String(row.category ?? "general"),
    payment_method: String(row.payment_method ?? "cash"),
    notes: row.notes != null ? String(row.notes) : null,
    staff_id: row.staff_id != null ? String(row.staff_id) : null,
    incurred_at: iso(row.incurred_at),
    created_by: String(row.created_by),
    created_at: iso(row.created_at),
    client_id: row.client_id != null ? String(row.client_id) : null,
    sync_status: String(row.sync_status ?? "synced"),
  };
}

function mapDebtor(row: Record<string, unknown>): DebtorRecord {
  const total = num(row.total_amount);
  const paid = num(row.amount_paid);
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    customer_name: String(row.customer_name),
    phone: row.phone != null ? String(row.phone) : null,
    total_amount: total,
    amount_paid: paid,
    balance: row.balance != null ? num(row.balance) : total - paid,
    due_date: row.due_date != null ? String(row.due_date).slice(0, 10) : null,
    status: (row.status as DebtorStatus) || "open",
    notes: row.notes != null ? String(row.notes) : null,
    created_by: String(row.created_by),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapPayment(row: Record<string, unknown>): DebtorPayment {
  return {
    id: String(row.id),
    debtor_id: String(row.debtor_id),
    amount_paid: num(row.amount_paid),
    paid_at: iso(row.paid_at),
    note: row.note != null ? String(row.note) : null,
    created_by: String(row.created_by),
  };
}

function mapPin(row: Record<string, unknown>, sale?: Record<string, unknown> | null): AdminPin {
  return {
    code: String(row.code),
    period: row.period as SubscriptionPeriod,
    duration_days: Number(row.duration_days),
    redeemed_by: row.redeemed_by != null ? String(row.redeemed_by) : null,
    redeemed_at: isoOrNull(row.redeemed_at),
    expires_at: isoOrNull(row.expires_at),
    notes: String(row.notes ?? ""),
    created_at: iso(row.created_at),
    source: ((sale?.source as "paystack" | undefined) ?? "admin") as "admin" | "paystack",
    buyer_email: sale?.buyer_email != null ? String(sale.buyer_email) : null,
    buyer_name: sale?.buyer_name != null ? String(sale.buyer_name) : null,
    buyer_phone: sale?.buyer_phone != null ? String(sale.buyer_phone) : null,
    amount_paid: sale?.amount_paid != null ? Number(sale.amount_paid) : null,
    currency: (sale?.currency as "NGN" | "USD" | null) ?? null,
    paystack_reference: sale?.paystack_reference != null ? String(sale.paystack_reference) : null,
    paystack_status: sale?.paystack_status != null ? String(sale.paystack_status) : null,
    sold_at: sale?.sold_at != null ? iso(sale.sold_at) : null,
    email_status: (sale?.email_status as "pending" | "sent" | "failed" | null) ?? null,
  };
}

function mapPinSale(row: Record<string, unknown>): PinSale {
  return {
    id: String(row.id),
    pin_code: String(row.pin_code),
    plan_id: String(row.plan_id),
    period: row.period as SubscriptionPeriod,
    duration_days: Number(row.duration_days),
    buyer_email: String(row.buyer_email),
    buyer_name: String(row.buyer_name ?? ""),
    buyer_phone: String(row.buyer_phone ?? ""),
    currency: row.currency as "NGN" | "USD",
    amount_paid: Number(row.amount_paid),
    paystack_reference: String(row.paystack_reference),
    paystack_status: String(row.paystack_status),
    source: "paystack",
    sold_at: iso(row.sold_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    email_status: (row.email_status as "pending" | "sent" | "failed") ?? "pending",
  };
}

export async function pgGetProfile(userId: string, email: string): Promise<Profile> {
  const pool = getPool();
  const existing = await pool.query(`SELECT * FROM profiles WHERE id = $1`, [userId]);
  if (existing.rows[0]) return mapProfile(existing.rows[0]);
  const created = await pool.query(
    `INSERT INTO profiles (id, email, preferred_currency)
     VALUES ($1, $2, 'NGN')
     ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, profiles.email)
     RETURNING *`,
    [userId, email],
  );
  return mapProfile(created.rows[0]);
}

export async function pgUpdateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "preferred_currency" | "email">>,
): Promise<Profile> {
  const pool = getPool();
  const created = await pgGetProfile(userId, patch.email ?? "");
  const nextEmail = patch.email ?? created.email;
  const nextCurrency = patch.preferred_currency ?? created.preferred_currency;
  const { rows } = await pool.query(
    `UPDATE profiles SET email = $2, preferred_currency = $3 WHERE id = $1 RETURNING *`,
    [userId, nextEmail, nextCurrency],
  );
  if (!rows[0]) throw new AppError(500, "INTERNAL", "Update failed");
  return mapProfile(rows[0]);
}

export async function pgGeneratePins(
  period: SubscriptionPeriod,
  count: number,
  notes = "",
): Promise<AdminPin[]> {
  const pool = getPool();
  const duration_days = period === "annual" ? 365 : 30;
  const label = notes.trim();
  const out: AdminPin[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateActivationCode();
    const { rows } = await pool.query(
      `INSERT INTO activation_pins (code, period, duration_days, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, period, duration_days, label],
    );
    out.push(mapPin(rows[0]));
  }
  return out;
}

export async function pgListPins(
  status: "unused" | "redeemed" | "all" = "all",
  limit = 100,
  search = "",
  period: "monthly" | "annual" | "all" = "all",
): Promise<AdminPin[]> {
  const pool = getPool();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status === "unused") clauses.push("p.redeemed_by IS NULL");
  if (status === "redeemed") clauses.push("p.redeemed_by IS NOT NULL");
  if (period === "monthly" || period === "annual") {
    params.push(period);
    clauses.push(`p.period = $${params.length}`);
  }
  const needle = search.trim().replace(/[%_]/g, "");
  if (needle) {
    params.push(`%${needle}%`);
    clauses.push(`(p.code ILIKE $${params.length} OR p.notes ILIKE $${params.length})`);
  }
  params.push(Math.min(Math.max(limit, 1), 200));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT p.*, row_to_json(s) AS sale
     FROM activation_pins p
     LEFT JOIN pin_sales s ON s.pin_code = p.code
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => mapPin(r, r.sale as Record<string, unknown> | null));
}

export async function pgGetPin(code: string): Promise<AdminPin | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*, row_to_json(s) AS sale
     FROM activation_pins p
     LEFT JOIN pin_sales s ON s.pin_code = p.code
     WHERE p.code = $1`,
    [code.trim().toUpperCase()],
  );
  if (!rows[0]) return null;
  return mapPin(rows[0], rows[0].sale as Record<string, unknown> | null);
}

export async function pgGetPinSaleByReference(reference: string): Promise<PinSale | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM pin_sales WHERE paystack_reference = $1`,
    [reference.trim()],
  );
  return rows[0] ? mapPinSale(rows[0]) : null;
}

export async function pgCreatePinSale(input: Omit<PinSale, "id" | "pin_code">): Promise<PinSale> {
  const existing = await pgGetPinSaleByReference(input.paystack_reference);
  if (existing) return existing;
  const pool = getPool();
  const client = await pool.connect();
  const code = generateActivationCode();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO activation_pins (code, period, duration_days, notes)
       VALUES ($1, $2, $3, $4)`,
      [
        code,
        input.period,
        input.duration_days,
        `Paystack sale ${input.paystack_reference} ${input.buyer_email}`.trim(),
      ],
    );
    const { rows } = await client.query(
      `INSERT INTO pin_sales (
         pin_code, plan_id, period, duration_days, buyer_email, buyer_name, buyer_phone,
         currency, amount_paid, paystack_reference, paystack_status, source, sold_at, metadata, email_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'paystack',$12,$13,$14)
       RETURNING *`,
      [
        code,
        input.plan_id,
        input.period,
        input.duration_days,
        input.buyer_email,
        input.buyer_name,
        input.buyer_phone,
        input.currency,
        input.amount_paid,
        input.paystack_reference,
        input.paystack_status,
        input.sold_at,
        JSON.stringify(input.metadata ?? {}),
        input.email_status,
      ],
    );
    await client.query("COMMIT");
    return mapPinSale(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    const duplicate = await pgGetPinSaleByReference(input.paystack_reference);
    if (duplicate) return duplicate;
    throw err;
  } finally {
    client.release();
  }
}

export async function pgUpdatePinSaleEmailStatus(
  reference: string,
  email_status: "pending" | "sent" | "failed",
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE pin_sales SET email_status = $2 WHERE paystack_reference = $1`,
    [reference.trim(), email_status],
  );
}

export async function pgUpdatePin(
  code: string,
  patch: {
    period?: SubscriptionPeriod;
    duration_days?: number;
    expires_at?: string | null;
    notes?: string;
  },
): Promise<AdminPin> {
  const existing = await pgGetPin(code);
  if (!existing) throw new AppError(404, "NOT_FOUND", "PIN not found");
  if (existing.redeemed_by) {
    throw new AppError(400, "PIN_REDEEMED", "Cannot edit a redeemed PIN");
  }
  const period = patch.period ?? existing.period;
  const duration =
    patch.duration_days ??
    (patch.period ? (patch.period === "annual" ? 365 : 30) : existing.duration_days);
  const expires = patch.expires_at !== undefined ? patch.expires_at : existing.expires_at;
  const notes = patch.notes !== undefined ? patch.notes : existing.notes;
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE activation_pins
     SET period = $2, duration_days = $3, expires_at = $4, notes = $5
     WHERE code = $1 AND redeemed_by IS NULL
     RETURNING *`,
    [code.trim().toUpperCase(), period, duration, expires, notes],
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "PIN not found or already redeemed");
  return mapPin(rows[0]);
}

export async function pgDeletePin(code: string): Promise<void> {
  const existing = await pgGetPin(code);
  if (!existing) throw new AppError(404, "NOT_FOUND", "PIN not found");
  if (existing.redeemed_by) {
    throw new AppError(400, "PIN_REDEEMED", "Cannot delete a redeemed PIN");
  }
  const pool = getPool();
  await pool.query(
    `DELETE FROM activation_pins WHERE code = $1 AND redeemed_by IS NULL`,
    [code.trim().toUpperCase()],
  );
}

export async function pgRedeemPin(userId: string, code: string): Promise<Profile> {
  const normalized = code.trim().toUpperCase();
  if (isDemoPinCode(normalized) && !allowDemoPins()) {
    throw new AppError(400, "PIN_INVALID", "Invalid or already used PIN");
  }
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM redeem_activation_pin($1, $2::uuid, $3)`,
      [normalized, userId, allowDemoPins()],
    );
    if (!rows[0]) throw new AppError(400, "PIN_INVALID", "Invalid or already used PIN");
    return mapProfile(rows[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("PIN_INVALID")) {
      throw new AppError(400, "PIN_INVALID", "Invalid or already used PIN");
    }
    throw err;
  }
}

export async function pgGetBusinessForOwner(userId: string): Promise<BusinessProfile | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM business_profiles WHERE owner_user_id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0] ? mapBusiness(rows[0]) : null;
}

export async function pgRequireBusiness(userId: string): Promise<BusinessProfile> {
  const biz = await pgGetBusinessForOwner(userId);
  if (!biz) {
    throw new AppError(404, "NOT_FOUND", "Create a business profile first");
  }
  return biz;
}

async function seedCategories(businessId: string) {
  const pool = getPool();
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    await pool.query(
      `INSERT INTO expense_categories (business_id, name, icon)
       VALUES ($1, $2, $3)
       ON CONFLICT (business_id, name) DO NOTHING`,
      [businessId, cat.name, cat.icon],
    );
  }
}

export async function pgCreateBusiness(
  userId: string,
  input: { business_name: string; business_type?: string | null; currency?: string },
): Promise<BusinessProfile> {
  const existing = await pgGetBusinessForOwner(userId);
  if (existing) return existing;
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO business_profiles (owner_user_id, business_name, business_type, currency)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, input.business_name.trim(), input.business_type ?? null, input.currency || "NGN"],
  );
  const biz = mapBusiness(rows[0]);
  await seedCategories(biz.id);
  await pool.query(
    `UPDATE profiles SET business_name = $2 WHERE id = $1`,
    [userId, biz.business_name],
  );
  return biz;
}

export async function pgUpdateBusiness(
  userId: string,
  patch: { business_name?: string; business_type?: string | null; currency?: string },
): Promise<BusinessProfile> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE business_profiles
     SET business_name = $2, business_type = $3, currency = $4, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      biz.id,
      patch.business_name?.trim() || biz.business_name,
      patch.business_type !== undefined ? patch.business_type : biz.business_type,
      patch.currency || biz.currency,
    ],
  );
  return mapBusiness(rows[0]);
}

export async function pgCreateSale(userId: string, input: SaleWrite): Promise<SaleRecord> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO sale_transactions (
       business_id, amount, item_or_service, payment_method, customer_name,
       quantity, unit_price, sold_at, notes, created_by, client_id, sync_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, now()),$9,$10,$11,'synced')
     RETURNING *`,
    [
      biz.id,
      input.amount,
      input.item_or_service ?? "",
      input.payment_method || "cash",
      input.customer_name ?? null,
      input.quantity ?? 1,
      input.unit_price ?? null,
      input.sold_at ?? null,
      input.notes ?? null,
      userId,
      input.client_id ?? null,
    ],
  );
  return mapSale(rows[0]);
}

export async function pgListSales(
  userId: string,
  opts: { from?: string; to?: string; limit?: number; offset?: number } = {},
): Promise<SaleRecord[]> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const params: unknown[] = [biz.id];
  const clauses = ["business_id = $1"];
  if (opts.from) {
    params.push(opts.from);
    clauses.push(`sold_at >= $${params.length}`);
  }
  if (opts.to) {
    params.push(opts.to);
    clauses.push(`sold_at <= $${params.length}`);
  }
  params.push(Math.min(Math.max(opts.limit ?? 100, 1), 200));
  params.push(Math.max(opts.offset ?? 0, 0));
  const { rows } = await pool.query(
    `SELECT * FROM sale_transactions
     WHERE ${clauses.join(" AND ")}
     ORDER BY sold_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapSale);
}

export async function pgGetSale(userId: string, id: string): Promise<SaleRecord> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM sale_transactions WHERE id = $1 AND business_id = $2`,
    [id, biz.id],
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Sale not found");
  return mapSale(rows[0]);
}

export async function pgUpdateSale(
  userId: string,
  id: string,
  patch: Partial<SaleWrite>,
): Promise<SaleRecord> {
  const current = await pgGetSale(userId, id);
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE sale_transactions SET
       amount = $3, item_or_service = $4, payment_method = $5, customer_name = $6,
       quantity = $7, unit_price = $8, sold_at = COALESCE($9::timestamptz, sold_at), notes = $10
     WHERE id = $1 AND business_id = $2
     RETURNING *`,
    [
      id,
      current.business_id,
      patch.amount ?? current.amount,
      patch.item_or_service ?? current.item_or_service,
      patch.payment_method ?? current.payment_method,
      patch.customer_name !== undefined ? patch.customer_name : current.customer_name,
      patch.quantity ?? current.quantity,
      patch.unit_price !== undefined ? patch.unit_price : current.unit_price,
      patch.sold_at ?? null,
      patch.notes !== undefined ? patch.notes : current.notes,
    ],
  );
  return mapSale(rows[0]);
}

export async function pgDeleteSale(userId: string, id: string): Promise<void> {
  const current = await pgGetSale(userId, id);
  const pool = getPool();
  await pool.query(`DELETE FROM sale_transactions WHERE id = $1 AND business_id = $2`, [
    id,
    current.business_id,
  ]);
}

export async function pgCreateExpense(userId: string, input: ExpenseWrite): Promise<ExpenseRecord> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO expense_transactions (
       business_id, amount, category, payment_method, notes, incurred_at, created_by, client_id, sync_status
     ) VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, now()),$7,$8,'synced')
     RETURNING *`,
    [
      biz.id,
      input.amount,
      input.category || "general",
      input.payment_method || "cash",
      input.notes ?? null,
      input.incurred_at ?? null,
      userId,
      input.client_id ?? null,
    ],
  );
  return mapExpense(rows[0]);
}

export async function pgListExpenses(
  userId: string,
  opts: { from?: string; to?: string; category?: string; limit?: number } = {},
): Promise<ExpenseRecord[]> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const params: unknown[] = [biz.id];
  const clauses = ["business_id = $1"];
  if (opts.from) {
    params.push(opts.from);
    clauses.push(`incurred_at >= $${params.length}`);
  }
  if (opts.to) {
    params.push(opts.to);
    clauses.push(`incurred_at <= $${params.length}`);
  }
  if (opts.category) {
    params.push(opts.category);
    clauses.push(`category = $${params.length}`);
  }
  params.push(Math.min(Math.max(opts.limit ?? 100, 1), 200));
  const { rows } = await pool.query(
    `SELECT * FROM expense_transactions
     WHERE ${clauses.join(" AND ")}
     ORDER BY incurred_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapExpense);
}

export async function pgGetExpense(userId: string, id: string): Promise<ExpenseRecord> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM expense_transactions WHERE id = $1 AND business_id = $2`,
    [id, biz.id],
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Expense not found");
  return mapExpense(rows[0]);
}

export async function pgUpdateExpense(
  userId: string,
  id: string,
  patch: Partial<ExpenseWrite>,
): Promise<ExpenseRecord> {
  const current = await pgGetExpense(userId, id);
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE expense_transactions SET
       amount = $3, category = $4, payment_method = $5, notes = $6,
       incurred_at = COALESCE($7::timestamptz, incurred_at)
     WHERE id = $1 AND business_id = $2
     RETURNING *`,
    [
      id,
      current.business_id,
      patch.amount ?? current.amount,
      patch.category ?? current.category,
      patch.payment_method ?? current.payment_method,
      patch.notes !== undefined ? patch.notes : current.notes,
      patch.incurred_at ?? null,
    ],
  );
  return mapExpense(rows[0]);
}

export async function pgDeleteExpense(userId: string, id: string): Promise<void> {
  const current = await pgGetExpense(userId, id);
  const pool = getPool();
  await pool.query(`DELETE FROM expense_transactions WHERE id = $1 AND business_id = $2`, [
    id,
    current.business_id,
  ]);
}

export async function pgListExpenseCategories(userId: string): Promise<ExpenseCategory[]> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM expense_categories WHERE business_id = $1 ORDER BY name`,
    [biz.id],
  );
  return rows.map((r) => ({
    id: String(r.id),
    business_id: String(r.business_id),
    name: String(r.name),
    icon: String(r.icon ?? "📦"),
  }));
}

export async function pgCreateDebtor(userId: string, input: DebtorWrite): Promise<DebtorRecord> {
  const biz = await pgRequireBusiness(userId);
  const paid = input.amount_paid ?? 0;
  const status: DebtorStatus =
    paid <= 0 ? "open" : paid >= input.total_amount ? "paid" : "partial";
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO debtors (
       business_id, customer_name, phone, total_amount, amount_paid, due_date, status, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      biz.id,
      input.customer_name.trim(),
      input.phone ?? null,
      input.total_amount,
      paid,
      input.due_date ?? null,
      status,
      input.notes ?? null,
      userId,
    ],
  );
  return mapDebtor(rows[0]);
}

export async function pgListDebtors(
  userId: string,
  status?: "open" | "paid" | "all",
): Promise<DebtorRecord[]> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const params: unknown[] = [biz.id];
  let extra = "";
  if (status && status !== "all") {
    params.push(status);
    extra = ` AND status = $2`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM debtors WHERE business_id = $1${extra} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(mapDebtor);
}

export async function pgGetDebtor(userId: string, id: string): Promise<DebtorRecord> {
  const biz = await pgRequireBusiness(userId);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM debtors WHERE id = $1 AND business_id = $2`,
    [id, biz.id],
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Debtor not found");
  return mapDebtor(rows[0]);
}

export async function pgListDebtorPayments(debtorId: string): Promise<DebtorPayment[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM debtor_payments WHERE debtor_id = $1 ORDER BY paid_at DESC`,
    [debtorId],
  );
  return rows.map(mapPayment);
}

export async function pgUpdateDebtor(
  userId: string,
  id: string,
  patch: Partial<DebtorWrite> & { status?: DebtorStatus },
): Promise<DebtorRecord> {
  const current = await pgGetDebtor(userId, id);
  const total = patch.total_amount ?? current.total_amount;
  const paid = patch.amount_paid ?? current.amount_paid;
  const status =
    patch.status ??
    (paid <= 0 ? "open" : paid >= total ? "paid" : "partial");
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE debtors SET
       customer_name = $3, phone = $4, total_amount = $5, amount_paid = $6,
       due_date = $7, status = $8, notes = $9, updated_at = now()
     WHERE id = $1 AND business_id = $2
     RETURNING *`,
    [
      id,
      current.business_id,
      patch.customer_name ?? current.customer_name,
      patch.phone !== undefined ? patch.phone : current.phone,
      total,
      paid,
      patch.due_date !== undefined ? patch.due_date : current.due_date,
      status,
      patch.notes !== undefined ? patch.notes : current.notes,
    ],
  );
  return mapDebtor(rows[0]);
}

export async function pgAddDebtorPayment(
  userId: string,
  id: string,
  amount: number,
  note?: string | null,
): Promise<{ debtor: DebtorRecord; payment: DebtorPayment }> {
  const current = await pgGetDebtor(userId, id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pay = await client.query(
      `INSERT INTO debtor_payments (debtor_id, amount_paid, note, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, amount, note ?? null, userId],
    );
    const nextPaid = current.amount_paid + amount;
    const status: DebtorStatus =
      nextPaid <= 0 ? "open" : nextPaid >= current.total_amount ? "paid" : "partial";
    const updated = await client.query(
      `UPDATE debtors SET amount_paid = $2, status = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, nextPaid, status],
    );
    await client.query("COMMIT");
    return { debtor: mapDebtor(updated.rows[0]), payment: mapPayment(pay.rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function pgDeleteDebtor(userId: string, id: string): Promise<void> {
  const current = await pgGetDebtor(userId, id);
  const pool = getPool();
  await pool.query(`DELETE FROM debtors WHERE id = $1 AND business_id = $2`, [
    id,
    current.business_id,
  ]);
}

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function pgDashboard(
  userId: string,
  range: "today" | "weekly" | "monthly",
): Promise<DashboardSummary> {
  const biz = await pgGetBusinessForOwner(userId);
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
  const from =
    range === "today" ? startOfTodayUtc() : range === "weekly" ? daysAgoIso(7) : daysAgoIso(30);
  const pool = getPool();
  const salesAgg = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count
     FROM sale_transactions WHERE business_id = $1 AND sold_at >= $2`,
    [biz.id, from],
  );
  const expAgg = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total
     FROM expense_transactions WHERE business_id = $1 AND incurred_at >= $2`,
    [biz.id, from],
  );
  const debtors = await pool.query(
    `SELECT COUNT(*)::int AS count FROM debtors WHERE business_id = $1 AND status <> 'paid'`,
    [biz.id],
  );
  const recentSales = await pool.query(
    `SELECT id, amount, item_or_service AS title, payment_method, sold_at AS occurred_at
     FROM sale_transactions WHERE business_id = $1 ORDER BY sold_at DESC LIMIT 8`,
    [biz.id],
  );
  const recentExp = await pool.query(
    `SELECT id, amount, category AS title, payment_method, incurred_at AS occurred_at
     FROM expense_transactions WHERE business_id = $1 ORDER BY incurred_at DESC LIMIT 8`,
    [biz.id],
  );
  const recent: LedgerItem[] = [
    ...recentSales.rows.map((r) => ({
      kind: "sale" as const,
      id: String(r.id),
      amount: num(r.amount),
      title: String(r.title ?? "Sale"),
      payment_method: String(r.payment_method ?? "cash"),
      occurred_at: iso(r.occurred_at),
    })),
    ...recentExp.rows.map((r) => ({
      kind: "expense" as const,
      id: String(r.id),
      amount: num(r.amount),
      title: String(r.title ?? "Expense"),
      payment_method: String(r.payment_method ?? "cash"),
      occurred_at: iso(r.occurred_at),
    })),
  ]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 10);

  const todaySales = num(salesAgg.rows[0]?.total);
  const todayExpenses = num(expAgg.rows[0]?.total);
  return {
    todaySales,
    todayExpenses,
    estimatedProfit: todaySales - todayExpenses,
    salesCount: Number(salesAgg.rows[0]?.count ?? 0),
    openDebtors: Number(debtors.rows[0]?.count ?? 0),
    recentTransactions: recent,
  };
}

export async function pgLoadReportData(userId: string): Promise<{
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  debtors: DebtorRecord[];
  payments: DebtorPayment[];
}> {
  const biz = await pgGetBusinessForOwner(userId);
  if (!biz) return { sales: [], expenses: [], debtors: [], payments: [] };
  const pool = getPool();
  const [saleRes, expRes, debtorRes, payRes] = await Promise.all([
    pool.query(`SELECT * FROM sale_transactions WHERE business_id = $1`, [biz.id]),
    pool.query(`SELECT * FROM expense_transactions WHERE business_id = $1`, [biz.id]),
    pool.query(`SELECT * FROM debtors WHERE business_id = $1`, [biz.id]),
    pool.query(
      `SELECT p.* FROM debtor_payments p
       JOIN debtors d ON d.id = p.debtor_id
       WHERE d.business_id = $1`,
      [biz.id],
    ),
  ]);
  return {
    sales: saleRes.rows.map(mapSale),
    expenses: expRes.rows.map(mapExpense),
    debtors: debtorRes.rows.map(mapDebtor),
    payments: payRes.rows.map(mapPayment),
  };
}

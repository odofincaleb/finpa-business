import crypto from "crypto";
import { AppError } from "../lib/errors";
import { createPaystackPinSale, getPaystackPinSaleByReference, updatePaystackPinSaleEmailStatus, type PinSale } from "./database";

export type BusinessPaystackPlanId =
  | "monthly_ngn"
  | "annual_ngn"
  | "launch_annual_ngn"
  | "monthly_usd"
  | "annual_usd"
  | "launch_annual_usd";

export type BusinessPaystackPlan = {
  id: BusinessPaystackPlanId;
  label: string;
  period: "monthly" | "annual";
  durationDays: number;
  currency: "NGN" | "USD";
  amountSubunits: number;
};

export const BUSINESS_PAYSTACK_PLANS: Record<BusinessPaystackPlanId, BusinessPaystackPlan> = {
  monthly_ngn: {
    id: "monthly_ngn",
    label: "FINPA Business Monthly",
    period: "monthly",
    durationDays: 30,
    currency: "NGN",
    amountSubunits: 300_000,
  },
  annual_ngn: {
    id: "annual_ngn",
    label: "FINPA Business Annual",
    period: "annual",
    durationDays: 365,
    currency: "NGN",
    amountSubunits: 2_500_000,
  },
  launch_annual_ngn: {
    id: "launch_annual_ngn",
    label: "FINPA Business Launch Annual Promo",
    period: "annual",
    durationDays: 365,
    currency: "NGN",
    amountSubunits: 2_000_000,
  },
  monthly_usd: {
    id: "monthly_usd",
    label: "FINPA Business USD Monthly",
    period: "monthly",
    durationDays: 30,
    currency: "USD",
    amountSubunits: 699,
  },
  annual_usd: {
    id: "annual_usd",
    label: "FINPA Business USD Annual",
    period: "annual",
    durationDays: 365,
    currency: "USD",
    amountSubunits: 5_900,
  },
  launch_annual_usd: {
    id: "launch_annual_usd",
    label: "FINPA Business USD Launch Annual Promo",
    period: "annual",
    durationDays: 365,
    currency: "USD",
    amountSubunits: 4_900,
  },
};

export const BUSINESS_PLAN_IDS = Object.keys(BUSINESS_PAYSTACK_PLANS) as BusinessPaystackPlanId[];
export const BUSINESS_PRODUCT = "finpa-business";

export type PaystackInitializeRequest = {
  email: string;
  amount: number;
  currency: "NGN" | "USD";
  reference: string;
  callback_url?: string;
  metadata: Record<string, unknown>;
};

export type PaystackInitializeResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type PaystackVerifiedTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: "NGN" | "USD" | string;
  customer?: { email?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  paid_at?: string | null;
};

export type CheckoutRequest = {
  planId: string;
  buyerEmail: string;
  buyerName?: string;
  buyerPhone?: string;
  callbackUrl?: string;
};

function getPlan(planId: string): BusinessPaystackPlan {
  const plan = BUSINESS_PAYSTACK_PLANS[planId as BusinessPaystackPlanId];
  if (!plan) throw new AppError(400, "INVALID_PLAN", "Unknown FINPA Business checkout plan");
  return plan;
}

function normalizeEmail(email: string): string {
  const out = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(out)) {
    throw new AppError(400, "VALIDATION_ERROR", "A valid buyer email is required");
  }
  return out;
}

function makeReference(planId: BusinessPaystackPlanId): string {
  return `finpa_${planId}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export async function initializePaystackCheckout(
  request: CheckoutRequest,
  initializer = initializePaystackTransaction,
) {
  const plan = getPlan(request.planId);
  const buyerEmail = normalizeEmail(request.buyerEmail);
  const reference = makeReference(plan.id);
  const callbackUrl = request.callbackUrl || process.env.FINPA_PAYSTACK_CALLBACK_URL || undefined;

  const payload: PaystackInitializeRequest = {
    email: buyerEmail,
    amount: plan.amountSubunits,
    currency: plan.currency,
    reference,
    callback_url: callbackUrl,
    metadata: {
      product: BUSINESS_PRODUCT,
      plan_id: plan.id,
      period: plan.period,
      duration_days: plan.durationDays,
      buyer_name: (request.buyerName || "").trim() || undefined,
      buyer_phone: (request.buyerPhone || "").trim() || undefined,
    },
  };

  const data = await initializer(payload);
  return {
    ...data,
    reference,
    planId: plan.id,
    amountSubunits: plan.amountSubunits,
    currency: plan.currency,
  };
}

export async function initializePaystackTransaction(
  payload: PaystackInitializeRequest,
): Promise<PaystackInitializeResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new AppError(500, "PAYSTACK_NOT_CONFIGURED", "Paystack is not configured");

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: Partial<PaystackInitializeResult>;
  };
  if (!res.ok || !body.status || !body.data?.authorization_url || !body.data.access_code) {
    throw new AppError(502, "PAYSTACK_INIT_FAILED", body.message || "Could not start Paystack checkout");
  }
  return {
    authorization_url: body.data.authorization_url,
    access_code: body.data.access_code,
    reference: body.data.reference || payload.reference,
  };
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifiedTransaction> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new AppError(500, "PAYSTACK_NOT_CONFIGURED", "Paystack is not configured");
  const safeReference = encodeURIComponent(reference.trim());
  const res = await fetch(`https://api.paystack.co/transaction/verify/${safeReference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: PaystackVerifiedTransaction;
  };
  if (!res.ok || !body.status || !body.data) {
    throw new AppError(502, "PAYSTACK_VERIFY_FAILED", body.message || "Could not verify Paystack payment");
  }
  return body.data;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

async function deliverPinEmail(sale: PinSale): Promise<"sent" | "pending" | "failed"> {
  const webhookUrl = process.env.FINPA_PIN_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) return "pending";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const emailSecret = process.env.FINPA_PIN_EMAIL_WEBHOOK_SECRET;
    if (emailSecret) headers["x-finpa-email-secret"] = emailSecret;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      // Redirect: "follow" strips custom headers on Apps Script; also send secret in body.
      redirect: "follow",
      body: JSON.stringify({
        product: BUSINESS_PRODUCT,
        to: sale.buyer_email,
        subject: "Your FINPA Business activation PIN",
        pin: sale.pin_code,
        plan_id: sale.plan_id,
        period: sale.period,
        duration_days: sale.duration_days,
        currency: sale.currency,
        amount_paid: sale.amount_paid,
        reference: sale.paystack_reference,
        buyer_name: sale.buyer_name,
        webhook_secret: emailSecret || undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (res.ok && body.ok === true) return "sent";
    return "failed";
  } catch {
    return "failed";
  }
}

async function deliverPinEmailAndPersist(sale: PinSale): Promise<PinSale> {
  if (sale.email_status === "sent") return sale;
  const email_status = await deliverPinEmail(sale);
  if (email_status === sale.email_status) return sale;
  await updatePaystackPinSaleEmailStatus(sale.paystack_reference, email_status);
  return { ...sale, email_status };
}

export async function processVerifiedPaystackPurchase(
  reference: string,
  verifier = verifyPaystackTransaction,
): Promise<PinSale> {
  const existing = await getPaystackPinSaleByReference(reference);
  if (existing) return deliverPinEmailAndPersist(existing);

  const tx = await verifier(reference);
  if (tx.status !== "success") throw new AppError(400, "PAYMENT_NOT_SUCCESSFUL", "Payment is not successful");
  if (tx.reference !== reference) throw new AppError(400, "PAYMENT_REFERENCE_MISMATCH", "Payment reference mismatch");
  const plan = getPlan(metadataString(tx.metadata, "plan_id"));
  if (metadataString(tx.metadata, "product") !== BUSINESS_PRODUCT) {
    throw new AppError(400, "PAYMENT_PRODUCT_MISMATCH", "Payment is not for FINPA Business");
  }
  if (Number(tx.amount) !== plan.amountSubunits || String(tx.currency).toUpperCase() !== plan.currency) {
    throw new AppError(400, "PAYMENT_AMOUNT_MISMATCH", "Payment amount or currency mismatch");
  }

  const sale = await createPaystackPinSale({
    plan_id: plan.id,
    period: plan.period,
    duration_days: plan.durationDays,
    buyer_email: normalizeEmail(tx.customer?.email || metadataString(tx.metadata, "buyer_email")),
    buyer_name: metadataString(tx.metadata, "buyer_name"),
    buyer_phone: metadataString(tx.metadata, "buyer_phone"),
    currency: plan.currency,
    amount_paid: plan.amountSubunits,
    paystack_reference: reference,
    paystack_status: tx.status,
    source: "paystack",
    sold_at: tx.paid_at || new Date().toISOString(),
    metadata: tx.metadata || {},
    email_status: "pending",
  });

  return deliverPinEmailAndPersist(sale);
}

export function verifyPaystackWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

verifyPaystackWebhookSignature.signForTest = (rawBody: Buffer, secret: string) =>
  crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

export function verifyFinpaRouterSecret(headerValue: string | undefined): boolean {
  const secret = process.env.FINPA_PAYSTACK_ROUTER_SECRET;
  if (!secret || !headerValue) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(headerValue));
  } catch {
    return false;
  }
}

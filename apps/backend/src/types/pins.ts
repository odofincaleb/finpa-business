import type { SubscriptionPeriod } from "./transaction";

export type AdminPin = {
  code: string;
  period: SubscriptionPeriod;
  duration_days: number;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  notes: string;
  created_at: string;
  source: "admin" | "paystack";
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  amount_paid: number | null;
  currency: "NGN" | "USD" | null;
  paystack_reference: string | null;
  paystack_status: string | null;
  sold_at: string | null;
  email_status: "pending" | "sent" | "failed" | null;
};

export type PinSale = {
  id: string;
  pin_code: string;
  plan_id: string;
  period: SubscriptionPeriod;
  duration_days: number;
  buyer_email: string;
  buyer_name: string;
  buyer_phone: string;
  currency: "NGN" | "USD";
  amount_paid: number;
  paystack_reference: string;
  paystack_status: string;
  source: "paystack";
  sold_at: string;
  metadata: Record<string, unknown>;
  email_status: "pending" | "sent" | "failed";
};

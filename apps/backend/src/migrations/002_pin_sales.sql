-- FINPA Business: Paystack PIN sales (same shape as FINPA 007)
-- Creates activation_pins first so this file can run before 004.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS activation_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    period TEXT NOT NULL CHECK (period IN ('monthly', 'annual')),
    duration_days INT NOT NULL,
    redeemed_by UUID,
    redeemed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pin_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_code TEXT NOT NULL UNIQUE REFERENCES activation_pins (code) ON DELETE RESTRICT,
  plan_id TEXT NOT NULL CHECK (plan_id IN (
    'monthly_ngn',
    'annual_ngn',
    'launch_annual_ngn',
    'monthly_usd',
    'annual_usd',
    'launch_annual_usd'
  )),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'annual')),
  duration_days INT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL DEFAULT '',
  buyer_phone TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
  amount_paid INT NOT NULL,
  paystack_reference TEXT NOT NULL UNIQUE,
  paystack_status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'paystack' CHECK (source = 'paystack'),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_sales_pin_code_idx ON pin_sales (pin_code);
CREATE INDEX IF NOT EXISTS pin_sales_buyer_email_idx ON pin_sales (buyer_email);
CREATE INDEX IF NOT EXISTS pin_sales_sold_at_idx ON pin_sales (sold_at DESC);

-- FINPA Business: Core Schema
-- Run on finpa_business_prod and finpa_business_staging

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    business_name TEXT NOT NULL,
    business_type TEXT,
    currency TEXT NOT NULL DEFAULT 'NGN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_profiles_owner_user_id_idx
  ON business_profiles (owner_user_id);

CREATE TABLE IF NOT EXISTS sale_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    item_or_service TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT 'cash',
    customer_name TEXT,
    staff_id UUID,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(14,2),
    sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_id TEXT,
    sync_status TEXT DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS sale_transactions_business_sold_at_idx
  ON sale_transactions (business_id, sold_at DESC);

CREATE TABLE IF NOT EXISTS expense_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    staff_id UUID,
    incurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_id TEXT,
    sync_status TEXT DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS expense_transactions_business_incurred_at_idx
  ON expense_transactions (business_id, incurred_at DESC);

CREATE TABLE IF NOT EXISTS debtors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    phone TEXT,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debtors_business_status_idx
  ON debtors (business_id, status);

CREATE TABLE IF NOT EXISTS debtor_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id UUID NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
    amount_paid NUMERIC(14,2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT,
    created_by UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    UNIQUE(business_id, name)
);

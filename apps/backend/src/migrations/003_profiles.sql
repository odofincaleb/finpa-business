-- FINPA Business: user profiles (self-hosted Postgres, no auth.users FK)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    business_name TEXT,
    preferred_currency TEXT DEFAULT 'NGN',
    activated_at TIMESTAMPTZ,
    subscription_expires_at TIMESTAMPTZ,
    subscription_period TEXT,
    pin_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

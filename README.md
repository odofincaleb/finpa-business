# FINPA Business

Business sibling of FINPA: record sales and expenses, see daily profit, and track debtors. PIN activation and Paystack checkout stay compatible with the shared FINPA router.

**Do not deploy this repo over the live FINPA app.**

## Stack

- **Mobile**: Expo (React Native) + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Auth**: Supabase Auth (JWT)
- **Data**: Self-hosted Postgres via `DATABASE_URL` (`pg` Pool), or in-memory store for local/dev

## Apps

```text
apps/backend   Express API (port 3001)
apps/mobile    Expo app
apps/backend/src/migrations   VPS Postgres SQL
```

## Backend

```bash
cp apps/backend/.env.example apps/backend/.env
# set DATABASE_URL for VPS Postgres, or leave unset for memory mode
# set OPENROUTER_API_KEY, ADMIN_SECRET
# set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for JWT auth

npm install
npm run dev:backend
```

Health: `http://localhost:3001/health`

Without `DATABASE_URL`, auth is `Authorization: Bearer dev:<userId>:<email>`.
Demo PIN (when `ALLOW_DEMO_PINS=true`): **`BUS-DEMO-0001`**. Paid PINs use `BUS-XXXX-XXXX`.

## Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL=https://finpa-business.fideantech.com
# EXPO_PUBLIC_AUTH_REDIRECT_URL=finpa-business://auth/callback
npm run dev:mobile
```

## VPS migrations

See [`apps/backend/src/migrations/README.md`](apps/backend/src/migrations/README.md).

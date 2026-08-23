# FINPA Business Postgres migrations

Apply on the VPS to `finpa_business_prod` and `finpa_business_staging`. Do **not** run these against the live FINPA Supabase project.

```bash
# SSH
ssh finpa-business
cd /var/www/finpa-business
git pull origin main

cd apps/backend
npm install --legacy-peer-deps --no-audit
npx tsc --noEmit

# Migrations (from repo root)
psql -U finpa_business_admin -d finpa_business_prod -f apps/backend/src/migrations/001_business_schema.sql
psql -U finpa_business_admin -d finpa_business_prod -f apps/backend/src/migrations/002_pin_sales.sql
psql -U finpa_business_admin -d finpa_business_prod -f apps/backend/src/migrations/003_profiles.sql
psql -U finpa_business_admin -d finpa_business_prod -f apps/backend/src/migrations/004_activation_pins.sql
psql -U finpa_business_admin -d finpa_business_prod -f apps/backend/src/migrations/005_bus_demo_pin.sql

# Repeat for finpa_business_staging

pm2 restart finpa-business --update-env
curl http://localhost:3001/health
```

Nginx (`finpa-business.fideantech.com` → `127.0.0.1:3001`):

```nginx
server {
    listen 80;
    server_name finpa-business.fideantech.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Manual checks after deploy:

- `POST /api/business/profile` creates a profile
- `GET /api/business/dashboard` returns zeros when there is no data

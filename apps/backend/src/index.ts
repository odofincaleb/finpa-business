import path from "path";
import { config as loadEnv } from "dotenv";

// Always load apps/backend/.env (works whether started from repo root or package dir)
loadEnv({ path: path.resolve(__dirname, "../.env") });
loadEnv({ path: path.resolve(process.cwd(), "apps/backend/.env") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createApp } from "./app";
import { hasSupabase } from "./lib/supabase";
import { hasDatabase } from "./lib/pg";
import { allowDemoPins } from "./lib/securePin";
import { parseSuperAdminEmails } from "./middleware/auth";
import { memorySeedDemoPin } from "./services/memoryStore";

const app = createApp();
const port = Number(process.env.PORT || 3001);

app.listen(port, "0.0.0.0", () => {
  console.log(`FINPA Business backend listening on http://0.0.0.0:${port}`);
  console.log("[finpa-env-check]", {
    paystackSecretPresent: Boolean(process.env.PAYSTACK_SECRET_KEY),
    paystackSecretLength: process.env.PAYSTACK_SECRET_KEY?.length || 0,
    routerSecretPresent: Boolean(process.env.FINPA_PAYSTACK_ROUTER_SECRET),
    routerSecretLength: process.env.FINPA_PAYSTACK_ROUTER_SECRET?.length || 0,
    callbackUrlPresent: Boolean(process.env.FINPA_PAYSTACK_CALLBACK_URL),
  });
  if (!hasDatabase()) {
    memorySeedDemoPin();
    console.warn(
      "[finpa-business] DATABASE_URL/Supabase data not configured — using in-memory store. Auth: Bearer dev:<userId>:<email>",
    );
    if (allowDemoPins()) {
      console.warn("[finpa-business] Demo PIN (memory mode): FINPA-DEMO-0001");
    } else {
      console.warn(
        "[finpa-business] Demo PINs disabled (ALLOW_DEMO_PINS!=true). Generate PINs via admin API.",
      );
    }
  }
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("[finpa-business] OPENROUTER_API_KEY missing — AI routes will fail until set.");
  }
  const admins = parseSuperAdminEmails();
  if (admins.length) {
    console.log(`[finpa-business] Super admins: ${admins.join(", ")}`);
  } else {
    console.warn(
      "[finpa-business] SUPERADMIN_EMAILS unset — in-app PIN admin disabled (x-admin-secret still works).",
    );
  }
});

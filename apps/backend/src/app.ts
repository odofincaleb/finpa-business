import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";
import meRoutes from "./routes/me.routes";
import pinsRoutes from "./routes/pins.routes";
import adminPinsRoutes from "./routes/adminPins.routes";
import checkoutRoutes from "./routes/checkout.routes";
import businessRouter from "./routes/business.routes";
import salesRouter from "./routes/sales.routes";
import expensesRouter from "./routes/expenses.routes";
import debtorsRouter from "./routes/debtors.routes";
import dashboardRouter from "./routes/dashboard.routes";
import chatRouter from "./routes/chat.routes";
import reportsRouter, { exportRouter } from "./routes/reports.routes";
import { AppError } from "./lib/errors";
import { hasSupabase } from "./lib/supabase";
import { hasDatabase } from "./lib/pg";
import { parseSuperAdminEmails } from "./middleware/auth";

export function healthPayload() {
  return {
    ok: true,
    service: "finpa-business-backend",
    supabase: hasSupabase(),
    postgres: hasDatabase(),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    superadmins: parseSuperAdminEmails().length,
  };
}

export function createApp() {
  const app = express();
  // Belmo / reverse proxies send X-Forwarded-For
  app.set("trust proxy", 1);

  app.use(cors());
  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));

  app.get("/", (_req, res) => {
    res.json(healthPayload());
  });

  app.get("/health", (_req, res) => {
    res.json(healthPayload());
  });

  app.use("/api/me", meRoutes);
  app.use("/api/pins", pinsRoutes);
  app.use("/api/admin/pins", adminPinsRoutes);
  app.use("/api/checkout", checkoutRoutes);
  app.use("/api/business/profile", businessRouter);
  app.use("/api/business/chat", chatRouter);
  app.use("/api/business/sales", salesRouter);
  app.use("/api/business/expenses", expensesRouter);
  app.use("/api/business/debtors", debtorsRouter);
  app.use("/api/business/dashboard", dashboardRouter);
  app.use("/api/business/reports", reportsRouter);
  app.use("/api/business/export", exportRouter);
  app.use("/api", aiRoutes);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof AppError) {
        res.status(err.status).json({ code: err.code, message: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ code: "INTERNAL", message: "Unexpected server error" });
    },
  );

  return app;
}

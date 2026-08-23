import { Router } from "express";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { AppError } from "../lib/errors";
import {
  getDailyReport,
  getExportCsv,
  getExportData,
  getMonthlyReport,
  getWeeklyReport,
} from "../services/database";
import { resolveMonth, resolveReportDate } from "../services/reports";
import type { ExportType } from "../types/reports";

const router = Router();

function asExportType(raw: unknown): ExportType {
  if (raw === "weekly" || raw === "monthly" || raw === "daily") return raw;
  throw new AppError(400, "VALIDATION_ERROR", "type must be daily, weekly, or monthly");
}

router.get("/daily", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const date = resolveReportDate(typeof req.query.date === "string" ? req.query.date : undefined);
    res.json(await getDailyReport(userId, date));
  } catch (err) {
    next(err);
  }
});

router.get("/weekly", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const end = resolveReportDate(
      typeof req.query.end === "string"
        ? req.query.end
        : typeof req.query.date === "string"
          ? req.query.date
          : undefined,
    );
    res.json(await getWeeklyReport(userId, end));
  } catch (err) {
    next(err);
  }
});

router.get("/monthly", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const { year, month } = resolveMonth(
      typeof req.query.year === "string" ? req.query.year : undefined,
      typeof req.query.month === "string" ? req.query.month : undefined,
      typeof req.query.date === "string" ? req.query.date : undefined,
    );
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid year");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid month");
    }
    res.json(await getMonthlyReport(userId, year, month));
  } catch (err) {
    next(err);
  }
});

export default router;

export const exportRouter = Router();

exportRouter.get("/csv", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const type = asExportType(req.query.type ?? "daily");
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const csv = await getExportCsv(userId, type, date, year, month);
    const stamp = date || `${year ?? ""}-${month ?? ""}` || "report";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="finpa-business-${type}-${stamp}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

exportRouter.get("/data", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const type = asExportType(req.query.type ?? "daily");
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    res.json(await getExportData(userId, type, date, year, month));
  } catch (err) {
    next(err);
  }
});

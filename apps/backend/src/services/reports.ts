import { hasDatabase } from "../lib/pg";
import type { ExportData, ExportType, DailyReport, MonthlyReport, WeeklyReport } from "../types/reports";
import { memoryLoadReportData } from "./memoryBusiness";
import { pgLoadReportData } from "./pgStore";
import {
  buildDailyReport,
  buildMonthlyReport,
  buildWeeklyReport,
  csvFromDaily,
  csvFromMonthly,
  csvFromWeekly,
  dailyNotes,
  monthBounds,
  parseYmd,
  shareTextDaily,
  shareTextMonthly,
  shareTextWeekly,
  todayYmd,
} from "./reportBuilder";

async function load(userId: string) {
  if (hasDatabase()) return pgLoadReportData(userId);
  return memoryLoadReportData(userId);
}

export async function getDailyReport(userId: string, date = todayYmd()): Promise<DailyReport> {
  const data = await load(userId);
  return buildDailyReport(date, data.sales, data.expenses, data.debtors, data.payments);
}

export async function getWeeklyReport(userId: string, endDate = todayYmd()): Promise<WeeklyReport> {
  const data = await load(userId);
  return buildWeeklyReport(endDate, data.sales, data.expenses);
}

export async function getMonthlyReport(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlyReport> {
  const data = await load(userId);
  return buildMonthlyReport(year, month, data.sales, data.expenses);
}

export async function getExportCsv(
  userId: string,
  type: ExportType,
  date?: string,
  year?: number,
  month?: number,
): Promise<string> {
  const pack = await getExportData(userId, type, date, year, month);
  return pack.csv;
}

export async function getExportData(
  userId: string,
  type: ExportType,
  date?: string,
  year?: number,
  month?: number,
): Promise<ExportData> {
  const now = new Date();
  if (type === "weekly") {
    const end = parseYmd(date) ?? todayYmd();
    const weekly = await getWeeklyReport(userId, end);
    return { type, weekly, csv: csvFromWeekly(weekly), shareText: shareTextWeekly(weekly) };
  }
  if (type === "monthly") {
    const y = year ?? now.getUTCFullYear();
    const m = month ?? now.getUTCMonth() + 1;
    const monthly = await getMonthlyReport(userId, y, m);
    return { type, monthly, csv: csvFromMonthly(monthly), shareText: shareTextMonthly(monthly) };
  }
  const day = parseYmd(date) ?? todayYmd();
  const data = await load(userId);
  const daily = buildDailyReport(day, data.sales, data.expenses, data.debtors, data.payments);
  return {
    type: "daily",
    daily,
    csv: csvFromDaily(daily, dailyNotes(data.sales, data.expenses, day)),
    shareText: shareTextDaily(daily),
  };
}

export function resolveReportDate(raw?: string) {
  return parseYmd(raw) ?? todayYmd();
}

export function resolveMonth(yearRaw?: string, monthRaw?: string, dateRaw?: string) {
  const fromDate = parseYmd(dateRaw);
  if (fromDate) {
    return { year: Number(fromDate.slice(0, 4)), month: Number(fromDate.slice(5, 7)) };
  }
  const now = new Date();
  const year = yearRaw ? Number(yearRaw) : now.getUTCFullYear();
  const month = monthRaw ? Number(monthRaw) : now.getUTCMonth() + 1;
  return { year, month, bounds: monthBounds(year, month) };
}

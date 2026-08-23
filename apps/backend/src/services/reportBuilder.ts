import type {
  DailyReport,
  MonthlyReport,
  PaymentMethodTotals,
  WeeklyReport,
} from "../types/reports";
import type { DebtorPayment, DebtorRecord, ExpenseRecord, SaleRecord } from "../types/business";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ymd(iso: string): string {
  return iso.slice(0, 10);
}

export function addUtcDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseYmd(raw?: string): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return null;
  return raw;
}

export function inRange(iso: string, start: string, endInclusive: string): boolean {
  const key = ymd(iso);
  return key >= start && key <= endInclusive;
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = addUtcDays(
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`,
    -1,
  );
  return { start, end };
}

function emptyMethods(): PaymentMethodTotals {
  return { cash: 0, pos: 0, transfer: 0, credit: 0 };
}

function methodKey(raw: string): keyof PaymentMethodTotals {
  if (raw === "pos" || raw === "transfer" || raw === "credit") return raw;
  return "cash";
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function naira(amount: number) {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

function compactNaira(amount: number) {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 10_000) return `₦${Math.round(amount / 1000)}k`;
  return naira(amount);
}

export function buildDailyReport(
  date: string,
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
  debtors: DebtorRecord[],
  payments: DebtorPayment[],
): DailyReport {
  const daySales = sales.filter((s) => ymd(s.sold_at) === date);
  const dayExpenses = expenses.filter((e) => ymd(e.incurred_at) === date);
  const byMethod = emptyMethods();
  for (const s of daySales) byMethod[methodKey(s.payment_method)] += s.amount;
  const byCategory: Record<string, number> = {};
  for (const e of dayExpenses) {
    const cat = e.category || "Miscellaneous";
    byCategory[cat] = (byCategory[cat] ?? 0) + e.amount;
  }
  const itemMap = new Map<string, number>();
  for (const s of daySales) {
    const label =
      s.quantity > 1 && s.item_or_service
        ? `${s.quantity} ${s.item_or_service}`
        : s.item_or_service || "Sale";
    itemMap.set(label, (itemMap.get(label) ?? 0) + s.amount);
  }
  const topItems = [...itemMap.entries()]
    .map(([item, amount]) => ({ item, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const salesTotal = daySales.reduce((a, s) => a + s.amount, 0);
  const expTotal = dayExpenses.reduce((a, e) => a + e.amount, 0);
  const open = debtors.filter((d) => d.status !== "paid");
  return {
    date,
    sales: { total: salesTotal, count: daySales.length, byMethod },
    expenses: { total: expTotal, count: dayExpenses.length, byCategory },
    profit: salesTotal - expTotal,
    topItems,
    debtors: {
      new: debtors.filter((d) => ymd(d.created_at) === date).length,
      collected: payments
        .filter((p) => ymd(p.paid_at) === date)
        .reduce((a, p) => a + p.amount_paid, 0),
      open: open.length,
      openTotal: open.reduce((a, d) => a + d.balance, 0),
    },
  };
}

export function buildWeeklyReport(
  endDate: string,
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
): WeeklyReport {
  const startDate = addUtcDays(endDate, -6);
  const dailyBreakdown = [];
  for (let i = 0; i < 7; i++) {
    const date = addUtcDays(startDate, i);
    const daySales = sales.filter((s) => ymd(s.sold_at) === date).reduce((a, s) => a + s.amount, 0);
    const dayExp = expenses.filter((e) => ymd(e.incurred_at) === date).reduce((a, e) => a + e.amount, 0);
    dailyBreakdown.push({ date, sales: daySales, expenses: dayExp, profit: daySales - dayExp });
  }
  const totalSales = dailyBreakdown.reduce((a, d) => a + d.sales, 0);
  const totalExpenses = dailyBreakdown.reduce((a, d) => a + d.expenses, 0);
  const totalProfit = totalSales - totalExpenses;
  const best = dailyBreakdown.reduce((bestDay, row) =>
    row.sales > bestDay.sales || (row.sales === bestDay.sales && row.profit > bestDay.profit)
      ? row
      : bestDay,
  );
  return {
    startDate,
    endDate,
    totalSales,
    totalExpenses,
    totalProfit,
    dailyBreakdown,
    bestDay: { date: best.date, sales: best.sales, profit: best.profit },
    avgDailySales: Math.round(totalSales / 7),
    avgDailyProfit: Math.round(totalProfit / 7),
  };
}

export function buildMonthlyReport(
  year: number,
  month: number,
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
): MonthlyReport {
  const { start, end } = monthBounds(year, month);
  const monthSales = sales.filter((s) => inRange(s.sold_at, start, end));
  const monthExp = expenses.filter((e) => inRange(e.incurred_at, start, end));
  const totalSales = monthSales.reduce((a, s) => a + s.amount, 0);
  const totalExpenses = monthExp.reduce((a, e) => a + e.amount, 0);
  const totalProfit = totalSales - totalExpenses;
  const weeklyBreakdown = [];
  let cursor = start;
  while (cursor <= end) {
    const weekEnd = addUtcDays(cursor, 6) > end ? end : addUtcDays(cursor, 6);
    const wSales = monthSales.filter((s) => inRange(s.sold_at, cursor, weekEnd)).reduce((a, s) => a + s.amount, 0);
    const wExp = monthExp.filter((e) => inRange(e.incurred_at, cursor, weekEnd)).reduce((a, e) => a + e.amount, 0);
    weeklyBreakdown.push({
      startDate: cursor,
      endDate: weekEnd,
      sales: wSales,
      expenses: wExp,
      profit: wSales - wExp,
    });
    cursor = addUtcDays(weekEnd, 1);
  }
  const catMap = new Map<string, number>();
  for (const e of monthExp) {
    const cat = e.category || "Miscellaneous";
    catMap.set(cat, (catMap.get(cat) ?? 0) + e.amount);
  }
  const topExpenseCategories = [...catMap.entries()]
    .map(([category, total]) => ({
      category,
      total,
      pct: totalExpenses ? Math.round((total / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const itemMap = new Map<string, { quantity: number; revenue: number }>();
  for (const s of monthSales) {
    const item = s.item_or_service || "Sale";
    const cur = itemMap.get(item) ?? { quantity: 0, revenue: 0 };
    cur.quantity += s.quantity || 1;
    cur.revenue += s.amount;
    itemMap.set(item, cur);
  }
  const topSellingItems = [...itemMap.entries()]
    .map(([item, v]) => ({ item, quantity: v.quantity, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  return {
    year,
    month,
    monthName: MONTH_NAMES[month - 1] ?? String(month),
    totalSales,
    totalExpenses,
    totalProfit,
    profitMargin: totalSales ? Math.round((totalProfit / totalSales) * 1000) / 10 : 0,
    weeklyBreakdown,
    topExpenseCategories,
    topSellingItems,
  };
}

export function csvFromDaily(report: DailyReport, notes: string): string {
  return [
    "Date,Sales,Expenses,Profit,Notes",
    [report.date, report.sales.total, report.expenses.total, report.profit, csvEscape(notes)].join(","),
  ].join("\n");
}

export function csvFromWeekly(report: WeeklyReport): string {
  const lines = [
    "Date,Sales,Expenses,Profit,Notes",
    ...report.dailyBreakdown.map((d) =>
      [d.date, d.sales, d.expenses, d.profit, d.date === report.bestDay.date ? "Best day" : ""].join(","),
    ),
    ["Total", report.totalSales, report.totalExpenses, report.totalProfit, csvEscape("Weekly total")].join(","),
  ];
  return lines.join("\n");
}

export function csvFromMonthly(report: MonthlyReport): string {
  const lines = [
    "Week,Sales,Expenses,Profit,Notes",
    ...report.weeklyBreakdown.map((w, i) =>
      [
        csvEscape(`${w.startDate}–${w.endDate}`),
        w.sales,
        w.expenses,
        w.profit,
        csvEscape(`Week ${i + 1}`),
      ].join(","),
    ),
    ["Total", report.totalSales, report.totalExpenses, report.totalProfit, csvEscape(report.monthName)].join(","),
    "",
    "Category,Total,Percent",
    ...report.topExpenseCategories.map((c) => [csvEscape(c.category), c.total, c.pct].join(",")),
  ];
  return lines.join("\n");
}

export function shareTextDaily(report: DailyReport): string {
  const tops = report.topItems
    .slice(0, 2)
    .map((t) => `${t.item} ${compactNaira(t.amount)}`)
    .join(" · ");
  return [
    "FINPA Business — Daily Report",
    `📅 ${report.date}`,
    "",
    `💰 Sales: ${naira(report.sales.total)}`,
    `📊 Expenses: ${naira(report.expenses.total)}`,
    `📈 Profit: ${naira(report.profit)}`,
    tops ? `Top: ${tops}` : "",
    `👥 ${report.debtors.open} open debtors (${compactNaira(report.debtors.openTotal)})`,
  ]
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

export function shareTextWeekly(report: WeeklyReport): string {
  return [
    "FINPA Business — Weekly Report",
    `📅 ${report.startDate} – ${report.endDate}`,
    "",
    `💰 Sales: ${naira(report.totalSales)}`,
    `📊 Expenses: ${naira(report.totalExpenses)}`,
    `📈 Profit: ${naira(report.totalProfit)}`,
    `Avg daily profit: ${naira(report.avgDailyProfit)}`,
    `Best day: ${report.bestDay.date} (${naira(report.bestDay.sales)} sales)`,
  ].join("\n");
}

export function shareTextMonthly(report: MonthlyReport): string {
  const tops = report.topSellingItems
    .slice(0, 2)
    .map((t) => `${t.item} ${compactNaira(t.revenue)}`)
    .join(" · ");
  return [
    "FINPA Business — Monthly Report",
    `📅 ${report.monthName} ${report.year}`,
    "",
    `💰 Sales: ${naira(report.totalSales)}`,
    `📊 Expenses: ${naira(report.totalExpenses)}`,
    `📈 Profit: ${naira(report.totalProfit)}`,
    `Margin: ${report.profitMargin}%`,
    tops ? `Top: ${tops}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function dailyNotes(sales: SaleRecord[], expenses: ExpenseRecord[], date: string): string {
  const bits = [
    ...sales
      .filter((s) => ymd(s.sold_at) === date)
      .slice(0, 3)
      .map((s) => `Sold ${s.item_or_service || "sale"} ${naira(s.amount)}`),
    ...expenses
      .filter((e) => ymd(e.incurred_at) === date)
      .slice(0, 2)
      .map((e) => `Paid ${e.category || "expense"} ${naira(e.amount)}`),
  ];
  return bits.join(", ");
}

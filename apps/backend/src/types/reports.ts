export type PaymentMethodTotals = {
  cash: number;
  pos: number;
  transfer: number;
  credit: number;
};

export type DailyReport = {
  date: string;
  sales: { total: number; count: number; byMethod: PaymentMethodTotals };
  expenses: { total: number; count: number; byCategory: Record<string, number> };
  profit: number;
  topItems: Array<{ item: string; amount: number }>;
  debtors: { new: number; collected: number; open: number; openTotal: number };
};

export type WeeklyDayRow = {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
};

export type WeeklyReport = {
  startDate: string;
  endDate: string;
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  dailyBreakdown: WeeklyDayRow[];
  bestDay: { date: string; sales: number; profit: number };
  avgDailySales: number;
  avgDailyProfit: number;
};

export type MonthlyWeekRow = {
  startDate: string;
  endDate: string;
  sales: number;
  expenses: number;
  profit: number;
};

export type MonthlyReport = {
  year: number;
  month: number;
  monthName: string;
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
  weeklyBreakdown: MonthlyWeekRow[];
  topExpenseCategories: Array<{ category: string; total: number; pct: number }>;
  topSellingItems: Array<{ item: string; quantity: number; revenue: number }>;
};

export type ExportType = "daily" | "weekly" | "monthly";

export type ExportData = {
  type: ExportType;
  csv: string;
  shareText: string;
  daily?: DailyReport;
  weekly?: WeeklyReport;
  monthly?: MonthlyReport;
};

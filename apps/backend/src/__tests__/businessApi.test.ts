import request from "supertest";
import { createApp } from "../app";
import { memoryResetForTests, memorySeedDemoPin } from "../services/memoryStore";
import { redeemPin } from "../services/database";

const DEV_TOKEN = "dev:11111111-1111-1111-1111-111111111111:owner@finpa.biz";

describe("business API (memory store)", () => {
  const app = createApp();

  beforeEach(async () => {
    process.env.ALLOW_DEMO_PINS = "true";
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    memoryResetForTests();
    memorySeedDemoPin();
    await redeemPin("11111111-1111-1111-1111-111111111111", "FINPA-DEMO-0001");
  });

  it("creates a business profile and returns zero dashboard", async () => {
    const created = await request(app)
      .post("/api/business/profile")
      .set("Authorization", `Bearer ${DEV_TOKEN}`)
      .send({ business_name: "Caleb Shop", currency: "NGN" });
    expect(created.status).toBe(201);
    expect(created.body.profile.business_name).toBe("Caleb Shop");

    const dash = await request(app)
      .get("/api/business/dashboard")
      .set("Authorization", `Bearer ${DEV_TOKEN}`);
    expect(dash.status).toBe(200);
    expect(dash.body.todaySales).toBe(0);
    expect(dash.body.todayExpenses).toBe(0);
    expect(dash.body.estimatedProfit).toBe(0);
  });

  it("builds daily/weekly/monthly reports and CSV export", async () => {
    await request(app)
      .post("/api/business/profile")
      .set("Authorization", `Bearer ${DEV_TOKEN}`)
      .send({ business_name: "Caleb Shop", currency: "NGN" });

    await request(app)
      .post("/api/business/sales")
      .set("Authorization", `Bearer ${DEV_TOKEN}`)
      .send({
        amount: 75000,
        item_or_service: "shirts",
        quantity: 5,
        payment_method: "pos",
        sold_at: "2026-08-23T10:00:00.000Z",
      });
    await request(app)
      .post("/api/business/sales")
      .set("Authorization", `Bearer ${DEV_TOKEN}`)
      .send({
        amount: 105000,
        item_or_service: "Rice",
        payment_method: "cash",
        sold_at: "2026-08-23T12:00:00.000Z",
      });
    await request(app)
      .post("/api/business/expenses")
      .set("Authorization", `Bearer ${DEV_TOKEN}`)
      .send({
        amount: 42000,
        category: "Inventory",
        payment_method: "transfer",
        incurred_at: "2026-08-23T09:00:00.000Z",
      });
    await request(app)
      .post("/api/business/debtors")
      .set("Authorization", `Bearer ${DEV_TOKEN}`)
      .send({ customer_name: "Mr Ade", total_amount: 50000, amount_paid: 0 });

    const daily = await request(app)
      .get("/api/business/reports/daily?date=2026-08-23")
      .set("Authorization", `Bearer ${DEV_TOKEN}`);
    expect(daily.status).toBe(200);
    expect(daily.body.sales.total).toBe(180000);
    expect(daily.body.sales.count).toBe(2);
    expect(daily.body.sales.byMethod.pos).toBe(75000);
    expect(daily.body.sales.byMethod.cash).toBe(105000);
    expect(daily.body.expenses.total).toBe(42000);
    expect(daily.body.profit).toBe(138000);
    expect(daily.body.debtors.open).toBe(1);

    const weekly = await request(app)
      .get("/api/business/reports/weekly?end=2026-08-23")
      .set("Authorization", `Bearer ${DEV_TOKEN}`);
    expect(weekly.status).toBe(200);
    expect(weekly.body.startDate).toBe("2026-08-17");
    expect(weekly.body.endDate).toBe("2026-08-23");
    expect(weekly.body.dailyBreakdown).toHaveLength(7);
    expect(weekly.body.totalSales).toBe(180000);
    expect(weekly.body.bestDay.date).toBe("2026-08-23");

    const monthly = await request(app)
      .get("/api/business/reports/monthly?year=2026&month=8")
      .set("Authorization", `Bearer ${DEV_TOKEN}`);
    expect(monthly.status).toBe(200);
    expect(monthly.body.monthName).toBe("August");
    expect(monthly.body.totalProfit).toBe(138000);
    expect(monthly.body.profitMargin).toBeGreaterThan(0);
    expect(monthly.body.topSellingItems[0].item).toMatch(/Rice|shirts/i);

    const csv = await request(app)
      .get("/api/business/export/csv?type=daily&date=2026-08-23")
      .set("Authorization", `Bearer ${DEV_TOKEN}`);
    expect(csv.status).toBe(200);
    expect(String(csv.headers["content-type"])).toMatch(/text\/csv/);
    expect(csv.text).toContain("Date,Sales,Expenses,Profit");
    expect(csv.text).toContain("2026-08-23");
    expect(csv.text).toContain("180000");

    const data = await request(app)
      .get("/api/business/export/data?type=weekly&date=2026-08-23")
      .set("Authorization", `Bearer ${DEV_TOKEN}`);
    expect(data.status).toBe(200);
    expect(data.body.type).toBe("weekly");
    expect(data.body.csv).toContain("Total");
    expect(data.body.shareText).toMatch(/FINPA Business/);
  });
});

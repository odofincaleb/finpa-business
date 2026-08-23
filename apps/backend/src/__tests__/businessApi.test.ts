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
});

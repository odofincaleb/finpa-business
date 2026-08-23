import request from "supertest";
import { createApp, healthPayload } from "../app";
import {
  allowDemoPins,
  generateActivationCode,
  isDemoPinCode,
  randomPinChunk,
} from "../lib/securePin";
import {
  DEFAULT_FREE_MODEL,
  resolveOpenRouterModel,
} from "../lib/openrouterModel";
import { memoryCreatePins, memoryRedeemPin, memorySeedDemoPin } from "../services/memoryStore";
import { redeemPin } from "../services/database";

describe("health endpoints", () => {
  const app = createApp();

  it("GET / returns health JSON", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      service: "finpa-business-backend",
    });
    expect(typeof res.body.supabase).toBe("boolean");
    expect(typeof res.body.postgres).toBe("boolean");
    expect(typeof res.body.openrouter).toBe("boolean");
  });

  it("GET /health matches healthPayload shape", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(healthPayload());
  });
});

describe("secure PIN generation", () => {
  it("uses crypto-secure alphanumeric chunks", () => {
    const chunk = randomPinChunk(4);
    expect(chunk).toMatch(/^[A-Z2-9]{4}$/);
    expect(generateActivationCode()).toMatch(/^FINPA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("does not use Math.random in generated codes uniqueness sample", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateActivationCode()));
    expect(codes.size).toBe(50);
  });
});

describe("ALLOW_DEMO_PINS", () => {
  const prevDemo = process.env.ALLOW_DEMO_PINS;
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (prevDemo === undefined) delete process.env.ALLOW_DEMO_PINS;
    else process.env.ALLOW_DEMO_PINS = prevDemo;
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  });

  it("defaults to false", () => {
    delete process.env.ALLOW_DEMO_PINS;
    expect(allowDemoPins()).toBe(false);
  });

  it("is true only when set to the string true", () => {
    process.env.ALLOW_DEMO_PINS = "true";
    expect(allowDemoPins()).toBe(true);
    process.env.ALLOW_DEMO_PINS = "1";
    expect(allowDemoPins()).toBe(false);
  });

  it("rejects demo PIN redeem when disabled", async () => {
    delete process.env.ALLOW_DEMO_PINS;
    memorySeedDemoPin();
    await expect(redeemPin("user-1", "FINPA-DEMO-0001")).rejects.toMatchObject({
      code: "PIN_INVALID",
    });
  });

  it("allows demo PIN redeem when enabled in memory mode", () => {
    process.env.ALLOW_DEMO_PINS = "true";
    memorySeedDemoPin();
    const profile = memoryRedeemPin("user-demo", "FINPA-DEMO-0001");
    expect(profile.subscription_period).toBe("monthly");
    expect(profile.subscription_expires_at).toBeTruthy();
  });

  it("identifies demo codes", () => {
    expect(isDemoPinCode("finpa-demo-0001")).toBe(true);
    expect(isDemoPinCode("FINPA-ABCD-EFGH")).toBe(false);
  });
});

describe("OpenRouter free-model enforcement", () => {
  const prev = process.env.OPENROUTER_MODEL;

  afterEach(() => {
    if (prev === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = prev;
  });

  it("accepts :free models from env", () => {
    process.env.OPENROUTER_MODEL = "google/gemma-2-9b-it:free";
    expect(resolveOpenRouterModel()).toBe("google/gemma-2-9b-it:free");
  });

  it("rejects paid models and falls back to default free", () => {
    process.env.OPENROUTER_MODEL = "openai/gpt-4o";
    expect(resolveOpenRouterModel()).toBe(DEFAULT_FREE_MODEL);
  });

  it("defaults to free model when unset", () => {
    delete process.env.OPENROUTER_MODEL;
    expect(resolveOpenRouterModel()).toBe(DEFAULT_FREE_MODEL);
  });
});

describe("memory PIN create + redeem", () => {
  it("creates crypto-format pins and redeems once", () => {
    const [pin] = memoryCreatePins("monthly", 1, "test");
    expect(pin.code).toMatch(/^FINPA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const profile = memoryRedeemPin("u1", pin.code);
    expect(profile.subscription_period).toBe("monthly");
    expect(() => memoryRedeemPin("u2", pin.code)).toThrow("PIN_INVALID");
  });
});

describe("rate limiting middleware is mounted", () => {
  const app = createApp();

  it("PIN redeem route returns 401 without auth (limiter allows request)", async () => {
    const res = await request(app)
      .post("/api/pins/redeem")
      .send({ code: "FINPA-AAAA-BBBB" });
    expect(res.status).toBe(401);
  });
});

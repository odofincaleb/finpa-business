import {
  BUSINESS_PAYSTACK_PLANS,
  initializePaystackCheckout,
  processVerifiedPaystackPurchase,
  verifyFinpaRouterSecret,
  verifyPaystackWebhookSignature,
} from "./payments";
import { listPins } from "./database";
import { memoryResetForTests } from "./memoryStore";
import {
  renderPaystackFailurePage,
  renderPaystackSuccessPage,
} from "../lib/paystackSuccessPage";

const PIN_RE = /^BUS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

beforeEach(() => {
  delete process.env.PAYSTACK_SECRET_KEY;
  delete process.env.FINPA_PUBLIC_BASE_URL;
  delete process.env.FINPA_PAYSTACK_ROUTER_SECRET;
  delete process.env.FINPA_PIN_EMAIL_WEBHOOK_URL;
  delete process.env.FINPA_PIN_EMAIL_WEBHOOK_SECRET;
  memoryResetForTests();
});

test("FINPA Business Paystack plans map approved NGN and USD amounts in subunits", () => {
  expect(BUSINESS_PAYSTACK_PLANS.monthly_ngn.amountSubunits).toBe(300000);
  expect(BUSINESS_PAYSTACK_PLANS.annual_ngn.amountSubunits).toBe(2500000);
  expect(BUSINESS_PAYSTACK_PLANS.launch_annual_ngn.amountSubunits).toBe(2000000);
  expect(BUSINESS_PAYSTACK_PLANS.monthly_usd.amountSubunits).toBe(699);
  expect(BUSINESS_PAYSTACK_PLANS.annual_usd.amountSubunits).toBe(5900);
  expect(BUSINESS_PAYSTACK_PLANS.launch_annual_usd.amountSubunits).toBe(4900);
});

test("initializePaystackCheckout validates plan server-side and sends exact Paystack payload", async () => {
  let payload: unknown;
  const checkout = await initializePaystackCheckout(
    {
      planId: "launch_annual_usd",
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer One",
      buyerPhone: "+234****5678",
    },
    async (request) => {
      payload = request;
      return {
        authorization_url: "https://checkout.paystack.com/mock",
        access_code: "access_mock",
        reference: request.reference,
      };
    },
  );

  expect(checkout.currency).toBe("USD");
  expect(checkout.amountSubunits).toBe(4900);
  expect(checkout.reference).toMatch(/^finpa_launch_annual_usd_/);
  expect(payload).toEqual({
    email: "buyer@example.com",
    amount: 4900,
    currency: "USD",
    reference: checkout.reference,
    callback_url: undefined,
    metadata: {
      product: "finpa-business",
      plan_id: "launch_annual_usd",
      period: "annual",
      duration_days: 365,
      buyer_name: "Buyer One",
      buyer_phone: "+234****5678",
    },
  });
});

test("verified Paystack purchase creates one sold PIN visible in admin inventory", async () => {
  const sale = await processVerifiedPaystackPurchase("finpa_ref_001", async () => ({
    status: "success",
    reference: "finpa_ref_001",
    amount: 300000,
    currency: "NGN",
    customer: { email: "buyer@example.com" },
    metadata: {
      product: "finpa-business",
      plan_id: "monthly_ngn",
      buyer_name: "Buyer One",
      buyer_phone: "+234****5678",
    },
  }));

  expect(sale.pin_code).toMatch(PIN_RE);
  expect(sale.plan_id).toBe("monthly_ngn");
  expect(sale.period).toBe("monthly");
  expect(sale.source).toBe("paystack");
  expect(sale.buyer_email).toBe("buyer@example.com");
  expect(sale.email_status).toBe("pending");

  const pins = await listPins("all", 20, "buyer@example.com", "all");
  expect(pins.length).toBe(1);
  expect(pins[0].code).toBe(sale.pin_code);
  expect(pins[0].source).toBe("paystack");
  expect(pins[0].buyer_email).toBe("buyer@example.com");
  expect(pins[0].paystack_reference).toBe("finpa_ref_001");
  expect(pins[0].amount_paid).toBe(300000);
  expect(pins[0].currency).toBe("NGN");
});

test("verified Paystack purchase is idempotent by reference", async () => {
  const verifier = async () => ({
    status: "success" as const,
    reference: "finpa_ref_dupe",
    amount: 2500000,
    currency: "NGN" as const,
    customer: { email: "buyer@example.com" },
    metadata: { product: "finpa-business", plan_id: "annual_ngn" },
  });

  const first = await processVerifiedPaystackPurchase("finpa_ref_dupe", verifier);
  const second = await processVerifiedPaystackPurchase("finpa_ref_dupe", verifier);

  expect(second.pin_code).toBe(first.pin_code);
  const pins = await listPins("all", 20, "finpa_ref_dupe", "all");
  expect(pins.length).toBe(1);
});

test("pending sale retries email after webhook is configured without creating a second PIN", async () => {
  const verifier = async () => ({
    status: "success" as const,
    reference: "finpa_ref_email_retry",
    amount: 300000,
    currency: "NGN" as const,
    customer: { email: "buyer@example.com" },
    metadata: {
      product: "finpa-business",
      plan_id: "monthly_ngn",
      buyer_name: "Buyer One",
    },
  });

  const first = await processVerifiedPaystackPurchase("finpa_ref_email_retry", verifier);
  expect(first.email_status).toBe("pending");

  let calls = 0;
  let capturedHeaders: Record<string, string> | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  process.env.FINPA_PIN_EMAIL_WEBHOOK_URL = "https://email-webhook.example/exec";
  process.env.FINPA_PIN_EMAIL_WEBHOOK_SECRET = "redacted_email_secret";
  const originalFetch = global.fetch;
  global.fetch = (async (_url, init) => {
    calls += 1;
    capturedHeaders = init?.headers as Record<string, string> | undefined;
    capturedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return {
      ok: true,
      json: async () => ({ ok: true, sent: true }),
    } as Response;
  }) as typeof fetch;

  try {
    const second = await processVerifiedPaystackPurchase("finpa_ref_email_retry", verifier);
    expect(second.pin_code).toBe(first.pin_code);
    expect(second.email_status).toBe("sent");
    expect(calls).toBe(1);
    expect(capturedHeaders).toMatchObject({
      "Content-Type": "application/json",
      "x-finpa-email-secret": "redacted_email_secret",
    });
    expect(capturedBody).toMatchObject({
      product: "finpa-business",
      to: "buyer@example.com",
      pin: first.pin_code,
      plan_id: "monthly_ngn",
      period: "monthly",
      duration_days: 30,
      currency: "NGN",
      amount_paid: 300000,
      reference: "finpa_ref_email_retry",
      buyer_name: "Buyer One",
      webhook_secret: "redacted_email_secret",
    });
  } finally {
    global.fetch = originalFetch;
  }

  const pins = await listPins("all", 20, "finpa_ref_email_retry", "all");
  expect(pins.length).toBe(1);
});

test("sent sale does not resend email unnecessarily", async () => {
  const verifier = async () => ({
    status: "success" as const,
    reference: "finpa_ref_email_sent",
    amount: 300000,
    currency: "NGN" as const,
    customer: { email: "buyer@example.com" },
    metadata: { product: "finpa-business", plan_id: "monthly_ngn" },
  });

  let calls = 0;
  process.env.FINPA_PIN_EMAIL_WEBHOOK_URL = "https://email-webhook.example/exec";
  process.env.FINPA_PIN_EMAIL_WEBHOOK_SECRET = "redacted_email_secret";
  const originalFetch = global.fetch;
  global.fetch = (async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({ ok: true, sent: true }),
    } as Response;
  }) as typeof fetch;

  try {
    const first = await processVerifiedPaystackPurchase("finpa_ref_email_sent", verifier);
    expect(first.email_status).toBe("sent");
    expect(calls).toBe(1);

    const second = await processVerifiedPaystackPurchase("finpa_ref_email_sent", verifier);
    expect(second.email_status).toBe("sent");
    expect(second.pin_code).toBe(first.pin_code);
    expect(calls).toBe(1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("success page HTML confirms payment without exposing PIN fields", () => {
  const html = renderPaystackSuccessPage({
    id: "sale-1",
    pin_code: "BUS-ABCD-EFGH",
    plan_id: "monthly_ngn",
    period: "monthly",
    duration_days: 30,
    buyer_email: "buyer@example.com",
    buyer_name: "Buyer",
    buyer_phone: "",
    currency: "NGN",
    amount_paid: 300000,
    paystack_reference: "finpa_ref_html",
    paystack_status: "success",
    source: "paystack",
    sold_at: new Date().toISOString(),
    metadata: {},
    email_status: "sent",
  });

  expect(html).toContain("Payment confirmed");
  expect(html).toContain("buyer@example.com");
  expect(html).toContain("finpa_ref_html");
  expect(html).toContain("Your activation PIN has been sent to your email.");
  expect(html).not.toContain("BUS-ABCD-EFGH");
  expect(html).not.toContain('"pin"');
  expect(html).not.toContain("pin_code");
  expect(html).not.toContain('"sale"');
});

test("failure page HTML is branded and never exposes PIN fields", () => {
  const html = renderPaystackFailurePage({
    title: "We could not verify this payment",
    message:
      "This Paystack reference is invalid, expired, unpaid, or not linked to a FINPA purchase.",
    reference: "finpa_fake_invalid_reference",
    supportCode: "PAYSTACK_VERIFY_FAILED",
  });

  expect(html).toContain("We could not verify this payment");
  expect(html).toContain("finpa_fake_invalid_reference");
  expect(html).toContain("invalid or expired");
  expect(html).toContain("Contact support");
  expect(html).not.toContain("pin_code");
  expect(html).not.toContain('"pin"');
  expect(html).not.toContain("PAYSTACK_SECRET");
  expect(html).not.toContain("Error:");
  expect(html).not.toContain("at processVerifiedPaystackPurchase");
});

test("unverified or mismatched Paystack transaction never issues a PIN", async () => {
  await expect(
    processVerifiedPaystackPurchase("finpa_ref_bad", async () => ({
      status: "success",
      reference: "finpa_ref_bad",
      amount: 999,
      currency: "NGN",
      customer: { email: "buyer@example.com" },
      metadata: { product: "finpa-business", plan_id: "monthly_ngn" },
    })),
  ).rejects.toThrow(/amount or currency mismatch/i);

  const pins = await listPins("all", 20, "", "all");
  expect(pins.length).toBe(0);
});

test("verifyPaystackWebhookSignature validates sha512 HMAC without exposing the secret", () => {
  process.env.PAYSTACK_SECRET_KEY = "redacted_test_secret";
  const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
  const signature = verifyPaystackWebhookSignature.signForTest(body, process.env.PAYSTACK_SECRET_KEY);
  expect(verifyPaystackWebhookSignature(body, signature)).toBe(true);
  expect(verifyPaystackWebhookSignature(body, "bad")).toBe(false);
});

test("FINPA router secret validates trusted Apps Script forwarding without accepting unsigned public requests", () => {
  delete process.env.FINPA_PAYSTACK_ROUTER_SECRET;
  expect(verifyFinpaRouterSecret("anything")).toBe(false);

  process.env.FINPA_PAYSTACK_ROUTER_SECRET = "redacted_router_secret";
  expect(verifyFinpaRouterSecret("redacted_router_secret")).toBe(true);
  expect(verifyFinpaRouterSecret("bad")).toBe(false);
  expect(verifyFinpaRouterSecret(undefined)).toBe(false);
});

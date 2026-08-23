import type { PinSale } from "../services/database";
import { BUSINESS_PAYSTACK_PLANS, type BusinessPaystackPlanId } from "../services/payments";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatMoney(amountSubunits: number, currency: string): string {
  const amount = amountSubunits / 100;
  try {
    return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "NGN" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function planLabel(planId: string): string {
  const plan = BUSINESS_PAYSTACK_PLANS[planId as BusinessPaystackPlanId];
  return plan?.label || planId.replace(/_/g, " ");
}

function emailStatusMessage(status: PinSale["email_status"]): string {
  if (status === "sent") {
    return "Your activation PIN has been sent to your email.";
  }
  if (status === "failed") {
    return "Your payment is confirmed, but automatic email delivery failed. Please contact Fidean support with your reference.";
  }
  return "Your payment is confirmed. Your activation PIN email is being prepared; if it does not arrive shortly, contact Fidean support with your reference.";
}

export function renderPaystackSuccessPage(sale: PinSale): string {
  const reference = escapeHtml(sale.paystack_reference);
  const email = escapeHtml(sale.buyer_email);
  const plan = escapeHtml(planLabel(sale.plan_id));
  const amount = escapeHtml(formatMoney(sale.amount_paid, sale.currency));
  const statusMsg = escapeHtml(emailStatusMessage(sale.email_status));
  const supportHref = escapeHtml(
    `mailto:support@fideantech.com?subject=FINPA Business PIN Support - ${sale.paystack_reference}`,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FINPA Business Payment Confirmed</title>
  <style>
    :root {
      --bg: #f4f6ff;
      --card: #ffffff;
      --ink: #101828;
      --muted: #667085;
      --line: #e6e9f5;
      --purple: #3c2dc4;
      --cyan: #12b5c9;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top right, rgba(18, 181, 201, 0.18), transparent 32%),
        radial-gradient(circle at top left, rgba(60, 45, 196, 0.16), transparent 28%),
        var(--bg);
      padding: 28px 16px;
    }
    .card {
      max-width: 640px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(16, 24, 40, 0.08);
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, var(--purple), var(--cyan));
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      padding: 8px 12px;
      border-radius: 999px;
    }
    h1 {
      margin: 18px 0 8px;
      font-size: 30px;
      line-height: 1.15;
    }
    p { color: var(--muted); line-height: 1.6; }
    .status {
      margin: 22px 0;
      padding: 16px 18px;
      border-radius: 16px;
      background: #eef2ff;
      border: 1px solid #d9e1ff;
      color: var(--ink);
      font-weight: 600;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td {
      padding: 12px 0;
      border-bottom: 1px solid #f0f2f8;
      font-size: 15px;
    }
    td:first-child { color: var(--muted); font-weight: 700; }
    td:last-child { text-align: right; font-weight: 800; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }
    a.button {
      display: inline-block;
      text-decoration: none;
      border-radius: 14px;
      padding: 12px 16px;
      font-weight: 800;
    }
    a.primary {
      background: var(--purple);
      color: #fff;
    }
    a.secondary {
      background: #eef2ff;
      color: var(--purple);
      border: 1px solid #d9e1ff;
    }
    .note {
      margin-top: 22px;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">FINPA Business Payment Confirmed</div>
    <h1>Payment confirmed</h1>
    <p>FINPA Business access is ready. Your activation details are being delivered securely.</p>
    <div class="status">${statusMsg}</div>
    <table>
      <tr><td>Email</td><td>${email}</td></tr>
      <tr><td>Plan</td><td>${plan}</td></tr>
      <tr><td>Amount</td><td>${amount}</td></tr>
      <tr><td>Reference</td><td>${reference}</td></tr>
    </table>
    <div class="actions">
      <a class="button primary" href="https://fideantech.com/finpa/">Get FINPA Business</a>
      <a class="button secondary" href="${supportHref}">Contact support</a>
    </div>
    <p class="note">For security, your activation PIN is not displayed on this public page. Check the email address above for your PIN.</p>
  </main>
</body>
</html>`;
}

export function renderPaystackFailurePage(input: {
  title: string;
  message: string;
  reference?: string;
  supportCode?: string;
}): string {
  const title = escapeHtml(input.title);
  const message = escapeHtml(input.message);
  const reference = escapeHtml(input.reference || "");
  const supportCode = escapeHtml(input.supportCode || "");
  const supportSubject = encodeURIComponent(
    `FINPA Business Payment Help - ${input.reference || "unknown"}`,
  );
  const supportHref = escapeHtml(`mailto:support@fideantech.com?subject=${supportSubject}`);
  const referenceRow = input.reference
    ? `<tr><td>Reference</td><td>${reference}</td></tr>`
    : "";
  const codeRow = input.supportCode
    ? `<tr><td>Support code</td><td>${supportCode}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FINPA Business Payment Help</title>
  <style>
    :root {
      --bg: #f4f6ff;
      --card: #ffffff;
      --ink: #101828;
      --muted: #667085;
      --line: #e6e9f5;
      --purple: #3c2dc4;
      --cyan: #12b5c9;
      --warn: #b54708;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top right, rgba(18, 181, 201, 0.18), transparent 32%),
        radial-gradient(circle at top left, rgba(60, 45, 196, 0.16), transparent 28%),
        var(--bg);
      padding: 28px 16px;
    }
    .card {
      max-width: 640px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(16, 24, 40, 0.08);
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, var(--purple), var(--cyan));
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      padding: 8px 12px;
      border-radius: 999px;
    }
    h1 {
      margin: 18px 0 8px;
      font-size: 30px;
      line-height: 1.15;
    }
    p { color: var(--muted); line-height: 1.6; }
    .status {
      margin: 22px 0;
      padding: 16px 18px;
      border-radius: 16px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: var(--warn);
      font-weight: 600;
    }
    ul {
      color: var(--muted);
      line-height: 1.7;
      padding-left: 18px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td {
      padding: 12px 0;
      border-bottom: 1px solid #f0f2f8;
      font-size: 15px;
    }
    td:first-child { color: var(--muted); font-weight: 700; }
    td:last-child { text-align: right; font-weight: 800; word-break: break-all; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }
    a.button {
      display: inline-block;
      text-decoration: none;
      border-radius: 14px;
      padding: 12px 16px;
      font-weight: 800;
    }
    a.primary {
      background: var(--purple);
      color: #fff;
    }
    a.secondary {
      background: #eef2ff;
      color: var(--purple);
      border: 1px solid #d9e1ff;
    }
    .note {
      margin-top: 22px;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">FINPA Business Payment Help</div>
    <h1>${title}</h1>
    <p>We could not verify this FINPA Business payment.</p>
    <div class="status">${message}</div>
    <p>This can happen when:</p>
    <ul>
      <li>the payment reference is invalid or expired</li>
      <li>the payment is still processing</li>
      <li>the payment was not successful</li>
      <li>the reference is not for FINPA Business</li>
    </ul>
    <table>
      ${referenceRow}
      ${codeRow}
    </table>
    <div class="actions">
      <a class="button primary" href="https://fideantech.com/finpa/">Get FINPA Business</a>
      <a class="button secondary" href="${supportHref}">Contact support</a>
    </div>
    <p class="note">If you were debited, contact Fidean support with your Paystack reference. For security, activation PINs are never shown on this page.</p>
  </main>
</body>
</html>`;
}

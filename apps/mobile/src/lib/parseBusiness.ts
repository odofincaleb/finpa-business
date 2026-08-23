export type PaymentMethod = "cash" | "pos" | "transfer" | "credit";

export type BusinessParseItem = {
  amount: number;
  quantity?: number;
  item_or_service?: string;
  customer_name?: string;
  payment_method?: PaymentMethod;
  category?: string;
  notes: string;
};

export type BusinessParseResult = {
  intent: "sale" | "expense" | "debtor";
  summary: string;
  items: BusinessParseItem[];
  debtor_name?: string;
  debtor_total?: number;
  debtor_paid?: number;
  debtor_balance?: number;
};

export type ParsedBusinessEntry =
  | {
      kind: "sale";
      amount: number;
      item_or_service: string;
      payment_method: PaymentMethod;
      customer_name?: string;
      quantity?: number;
    }
  | {
      kind: "expense";
      amount: number;
      category: string;
      payment_method: PaymentMethod;
      notes: string;
    }
  | {
      kind: "debtor";
      customer_name: string;
      total_amount: number;
      amount_paid: number;
      notes: string;
    };

const EXPENSE_CATEGORIES: { re: RegExp; name: string }[] = [
  { re: /\brent\b/i, name: "Rent" },
  { re: /\b(electricity|utility|utilities|light|power|nepa|phcn)\b/i, name: "Utilities" },
  { re: /\b(salary|salaries|wages|staff|payroll)\b/i, name: "Salaries" },
  { re: /\b(inventory|stock|tomato|tomatoes|goods|supplies|bought)\b/i, name: "Inventory" },
  { re: /\b(transport|fuel|petrol|diesel|delivery)\b/i, name: "Transport" },
  { re: /\b(marketing|ad|ads|advert)\b/i, name: "Marketing" },
  { re: /\b(repair|repairs|fix|maintenance)\b/i, name: "Repairs" },
  { re: /\b(food|drink|drinks|lunch|restaurant)\b/i, name: "Food & Drinks" },
];

function parseAmountToken(raw: string, suffix?: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const mul = suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;
  return n * mul;
}

function extractAmounts(text: string): { amount: number; index: number }[] {
  const re = /(?:₦|NGN\s*|N(?=\s*[\d.])|\$|USD\s*)?\s*([\d,]+(?:\.\d{1,2})?)\s*([kKmM])?(?=\b)/g;
  const out: { amount: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const amount = parseAmountToken(m[1], m[2]);
    if (amount == null) continue;
    const marked = /₦|NGN|\$|USD|[kKmM]/.test(m[0]) || /[.,]/.test(m[1]);
    const after = text.slice(m.index + m[0].length);
    if (!marked && amount < 1000 && /^\s*[A-Za-z]/.test(after)) continue;
    out.push({ amount, index: m.index });
  }
  return out;
}

function parsePaymentMethod(text: string): PaymentMethod {
  if (/\bpos\b/i.test(text)) return "pos";
  if (/\b(transfer|bank|gtb|opay|palmpay)\b/i.test(text)) return "transfer";
  if (/\b(credit|owing|on credit)\b/i.test(text)) return "credit";
  return "cash";
}

function parseMethodNear(text: string, from: number, to: number): PaymentMethod | undefined {
  const slice = text.slice(Math.max(0, from), Math.min(text.length, to));
  if (/\bpos\b/i.test(slice)) return "pos";
  if (/\b(transfer|bank)\b/i.test(slice)) return "transfer";
  if (/\bcredit\b/i.test(slice)) return "credit";
  if (/\bcash\b/i.test(slice)) return "cash";
  return undefined;
}

export function detectIntent(text: string): "sale" | "expense" | "debtor" | "unknown" {
  const t = text.trim();
  if (!t) return "unknown";
  if (
    /\b(credit|debtor|debt|owe|owing|balance|partial|deposit)\b/i.test(t) ||
    /\bgave\s+credit\b/i.test(t)
  ) {
    return "debtor";
  }
  if (/\b(paid by|received from|customer paid|client paid)\b/i.test(t)) return "sale";
  if (
    /\b(paid|bought|purchased|spent|rent|electricity|wages|salary|salaries|transport)\b/i.test(t) &&
    !/\b(sold|sale|sales)\b/i.test(t)
  ) {
    return "expense";
  }
  if (/\b(sold|sale|sales|received from|customer|client)\b/i.test(t)) return "sale";
  if (extractAmounts(t).length) return "sale";
  return "unknown";
}

function parseCustomer(text: string): string | undefined {
  const m =
    text.match(/\b(?:to|from)\s+(?:mr\.?\s+|mrs\.?\s+|miss\s+)?([A-Za-z][A-Za-z .'-]{1,40})/i) ||
    text.match(/\b(?:customer|client)\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  if (!m) return undefined;
  return m[1]
    .replace(/\b(for|via|with|pos|cash|transfer|credit)\b.*$/i, "")
    .trim()
    .replace(/[.,!?]+$/, "");
}

function parseQuantityAndItem(text: string): { quantity?: number; item: string } {
  const sold = text.match(/\b(?:sold|sale)\s+(\d+)\s+([A-Za-z][A-Za-z0-9 &.'-]{1,40})/i);
  if (sold) {
    return {
      quantity: Number(sold[1]),
      item: sold[2].replace(/\b(pos|cash|transfer|credit)\b/i, "").trim(),
    };
  }
  const forItem = text.match(/\bfor\s+([A-Za-z][A-Za-z0-9 &.'-]{1,40})/i);
  if (forItem) {
    return { item: forItem[1].replace(/\b(pos|cash|transfer|credit)\b/i, "").trim() };
  }
  return { item: "Sale" };
}

function expenseCategory(text: string): string {
  for (const row of EXPENSE_CATEGORIES) {
    if (row.re.test(text)) return row.name;
  }
  return "Miscellaneous";
}

function naira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function parseBusinessMessage(message: string): BusinessParseResult | null {
  const text = message.trim();
  if (!text) return null;
  const amounts = extractAmounts(text);
  if (!amounts.length) return null;
  const intent = detectIntent(text);
  if (intent === "unknown") return null;
  const customer = parseCustomer(text);
  const defaultMethod = parsePaymentMethod(text);

  if (intent === "debtor") {
    const total = amounts[0].amount;
    let paid = 0;
    const paidMatch = text.match(/\bpaid\s+(?:₦|NGN|N)?\s*([\d,]+(?:\.\d{1,2})?)\s*([kKmM])?/i);
    if (paidMatch) paid = parseAmountToken(paidMatch[1], paidMatch[2]) ?? 0;
    else if (/\bbalance\b/i.test(text) && amounts.length >= 2) {
      paid = Math.max(0, amounts[0].amount - amounts[amounts.length - 1].amount);
    }
    const name = customer || "Customer";
    const { item } = parseQuantityAndItem(text);
    return {
      intent: "debtor",
      summary: `Logged credit for ${name}: ${naira(total)}${paid ? ` (paid ${naira(paid)})` : ""}`,
      items: [{ amount: total, item_or_service: item, customer_name: name, payment_method: "credit", notes: text }],
      debtor_name: name,
      debtor_total: total,
      debtor_paid: paid,
      debtor_balance: Math.max(0, total - paid),
    };
  }

  if (intent === "expense") {
    const amount = amounts[0].amount;
    const category = expenseCategory(text);
    return {
      intent: "expense",
      summary: `Logged expense ${naira(amount)} under ${category}`,
      items: [{ amount, category, payment_method: defaultMethod, notes: text }],
    };
  }

  const items: BusinessParseItem[] = [];
  if (amounts.length > 1 && /\bsales today|cash.*pos|pos.*cash|,/i.test(text)) {
    for (let i = 0; i < amounts.length; i++) {
      const a = amounts[i];
      const next = amounts[i + 1]?.index ?? text.length;
      items.push({
        amount: a.amount,
        item_or_service: "Sale",
        payment_method: parseMethodNear(text, a.index, next) ?? defaultMethod,
        customer_name: customer,
        notes: text,
      });
    }
  } else {
    const { quantity, item } = parseQuantityAndItem(text);
    items.push({
      amount: amounts[0].amount,
      quantity,
      item_or_service: item,
      customer_name: customer,
      payment_method: defaultMethod,
      notes: text,
    });
  }
  const total = items.reduce((s, i) => s + i.amount, 0);
  return {
    intent: "sale",
    summary:
      items.length > 1
        ? `Logged ${items.length} sales totaling ${naira(total)}`
        : `Logged sale ${naira(total)}${items[0].item_or_service ? ` (${items[0].item_or_service})` : ""}`,
    items,
  };
}

export function parseBusinessQuickEntry(message: string): ParsedBusinessEntry | null {
  const parsed = parseBusinessMessage(message);
  if (!parsed) return null;
  if (parsed.intent === "debtor") {
    return {
      kind: "debtor",
      customer_name: parsed.debtor_name || "Customer",
      total_amount: parsed.debtor_total || parsed.items[0].amount,
      amount_paid: parsed.debtor_paid || 0,
      notes: message,
    };
  }
  if (parsed.intent === "expense") {
    const item = parsed.items[0];
    return {
      kind: "expense",
      amount: item.amount,
      category: item.category || "Miscellaneous",
      payment_method: item.payment_method || "cash",
      notes: item.notes,
    };
  }
  const item = parsed.items[0];
  return {
    kind: "sale",
    amount: item.amount,
    item_or_service: item.item_or_service || "Sale",
    payment_method: item.payment_method || "cash",
    customer_name: item.customer_name,
    quantity: item.quantity,
  };
}

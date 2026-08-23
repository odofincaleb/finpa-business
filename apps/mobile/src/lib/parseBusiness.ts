export type ParsedBusinessEntry =
  | {
      kind: "sale";
      amount: number;
      item_or_service: string;
      payment_method: "cash" | "pos" | "transfer" | "credit";
      customer_name?: string;
    }
  | {
      kind: "expense";
      amount: number;
      category: string;
      payment_method: "cash" | "pos" | "transfer" | "credit";
      notes: string;
    };

function parseAmount(text: string): number | null {
  const match = text.match(/[₦$€£]?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseMethod(text: string): "cash" | "pos" | "transfer" | "credit" {
  if (/\bpos\b/i.test(text)) return "pos";
  if (/\btransfer|bank\b/i.test(text)) return "transfer";
  if (/\bcredit|owing|debt\b/i.test(text)) return "credit";
  return "cash";
}

export function parseBusinessQuickEntry(message: string): ParsedBusinessEntry | null {
  const text = message.trim();
  const amount = parseAmount(text);
  if (amount == null) return null;
  const payment_method = parseMethod(text);
  const isSale = /\b(sold|sale|sales)\b/i.test(text);

  if (isSale) {
    const item =
      text
        .replace(/\b(sold|sale)\b/i, "")
        .replace(/[₦$€£]?\s*[\d,]+(?:\.\d{1,2})?/, "")
        .replace(/\b(pos|cash|transfer|credit)\b/i, "")
        .trim()
        .replace(/^[0-9]+\s+/, "") || "Sale";
    return { kind: "sale", amount, item_or_service: item, payment_method };
  }

  const categoryMatch = text.match(
    /\b(rent|utilities|salaries|inventory|transport|marketing|repairs|food|miscellaneous)\b/i,
  );
  const category = categoryMatch
    ? categoryMatch[1][0].toUpperCase() + categoryMatch[1].slice(1).toLowerCase()
    : "Miscellaneous";
  return { kind: "expense", amount, category, payment_method, notes: text };
}

import { Router } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { chatExpenseLimiter } from "../middleware/rateLimit";
import { extractBusinessChat } from "../services/openrouter";
import {
  createDebtor,
  createExpense,
  createSale,
  getBusinessProfile,
  getDashboard,
} from "../services/database";
import { AppError } from "../lib/errors";
import { parseBusinessMessage } from "../lib/localParse";
import type { CurrencyCode } from "../types/transaction";

const router = Router();
const DEFAULT_CATS = [
  "Rent",
  "Utilities",
  "Salaries",
  "Inventory",
  "Transport",
  "Marketing",
  "Repairs",
  "Food & Drinks",
  "Miscellaneous",
];

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  categories: z.array(z.string().min(1).max(64)).max(40).optional(),
});

function methodOf(raw?: string): "cash" | "pos" | "transfer" | "credit" {
  if (!raw) return "cash";
  if (/pos/i.test(raw)) return "pos";
  if (/transfer/i.test(raw)) return "transfer";
  if (/credit/i.test(raw)) return "credit";
  return "cash";
}

async function applyParsed(
  userId: string,
  parsed: NonNullable<ReturnType<typeof parseBusinessMessage>>,
) {
  const sales = [];
  const expenses = [];
  let debtor = null;
  if (parsed.intent === "debtor" && parsed.debtor_name && parsed.debtor_total != null) {
    debtor = await createDebtor(userId, {
      customer_name: parsed.debtor_name,
      total_amount: parsed.debtor_total,
      amount_paid: parsed.debtor_paid ?? 0,
      notes: parsed.items[0]?.notes ?? null,
    });
  } else if (parsed.intent === "expense") {
    for (const item of parsed.items) {
      expenses.push(
        await createExpense(userId, {
          amount: item.amount,
          category: item.category || "Miscellaneous",
          payment_method: methodOf(item.payment_method),
          notes: item.notes,
        }),
      );
    }
  } else {
    for (const item of parsed.items) {
      sales.push(
        await createSale(userId, {
          amount: item.amount,
          item_or_service: item.item_or_service || "Sale",
          payment_method: methodOf(item.payment_method),
          customer_name: item.customer_name ?? null,
          quantity: item.quantity ?? 1,
          notes: item.notes,
        }),
      );
    }
  }
  return { sales, expenses, debtor };
}

async function handleChat(req: Parameters<typeof requireAuth>[0], res: import("express").Response) {
  const { userId, profile } = req as AuthedRequest;
  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError(400, "VALIDATION_ERROR", "message is required");
  }

  const biz = await getBusinessProfile(userId);
  if (!biz) {
    res.json({
      ok: false,
      action: "clarify",
      summary: "Set up your business profile first, then I can log sales and expenses.",
    });
    return;
  }

  const message = parsedBody.data.message;
  const categories = parsedBody.data.categories?.length
    ? parsedBody.data.categories
    : DEFAULT_CATS;

  if (/\b(how much|what's my|what is my|who owes|profit|sell today|sold today)\b/i.test(message)) {
    const dash = await getDashboard(userId, "today");
    res.json({
      ok: true,
      action: "summary",
      intent: "summary",
      summary: `Today: sales ₦${dash.todaySales.toLocaleString("en-NG")}, expenses ₦${dash.todayExpenses.toLocaleString("en-NG")}, profit ₦${dash.estimatedProfit.toLocaleString("en-NG")}. Open debtors: ${dash.openDebtors}.`,
      dashboard: dash,
    });
    return;
  }

  const local = parseBusinessMessage(message);
  if (local) {
    const created = await applyParsed(userId, local);
    res.json({
      ok: true,
      action: "create",
      intent: local.intent,
      summary: local.summary,
      sale: created.sales[0] ?? null,
      sales: created.sales,
      expense: created.expenses[0] ?? null,
      expenses: created.expenses,
      debtor: created.debtor,
    });
    return;
  }

  const currency = (profile.preferred_currency || "NGN") as CurrencyCode;
  let ai;
  try {
    ai = await extractBusinessChat(message, currency, categories);
  } catch {
    res.json({
      ok: false,
      action: "clarify",
      summary: "I didn't understand that. Try: Sold 5 shirts ₦75k POS",
    });
    return;
  }

  if (ai.action === "summary" || ai.intent === "summary") {
    const dash = await getDashboard(userId, "today");
    res.json({
      ok: true,
      action: "summary",
      intent: "summary",
      summary: ai.summary,
      dashboard: dash,
    });
    return;
  }

  if (ai.action === "clarify") {
    res.json({
      ok: false,
      action: "clarify",
      summary: ai.summary || "I didn't understand that. Try: Sold 5 shirts ₦75k POS",
    });
    return;
  }

  if (ai.intent === "debtor" && ai.debtor?.customer_name) {
    const debtor = await createDebtor(userId, {
      customer_name: ai.debtor.customer_name,
      total_amount: ai.debtor.total_amount,
      amount_paid: ai.debtor.amount_paid ?? 0,
      notes: ai.debtor.notes ?? message,
    });
    res.json({ ok: true, action: "create", intent: "debtor", summary: ai.summary, debtor });
    return;
  }

  if (ai.intent === "expense" || (ai.items[0]?.category && !/\bsold|sale\b/i.test(message))) {
    const expenses = [];
    for (const item of ai.items) {
      expenses.push(
        await createExpense(userId, {
          amount: item.amount,
          category: item.category || "Miscellaneous",
          payment_method: methodOf(item.payment_method),
          notes: item.notes || message,
        }),
      );
    }
    res.json({
      ok: true,
      action: "create",
      intent: "expense",
      summary: ai.summary,
      expense: expenses[0] ?? null,
      expenses,
    });
    return;
  }

  const sales = [];
  for (const item of ai.items) {
    sales.push(
      await createSale(userId, {
        amount: item.amount,
        item_or_service: item.item_or_service || "Sale",
        payment_method: methodOf(item.payment_method),
        customer_name: item.customer_name ?? null,
        quantity: item.quantity ?? 1,
        notes: item.notes || message,
      }),
    );
  }
  res.json({
    ok: true,
    action: "create",
    intent: "sale",
    summary: ai.summary,
    sale: sales[0] ?? null,
    sales,
  });
}

router.post("/", chatExpenseLimiter, requireAuth, requireSubscription, async (req, res, next) => {
  try {
    await handleChat(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;

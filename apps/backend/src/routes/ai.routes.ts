import { Router } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { chatExpenseLimiter } from "../middleware/rateLimit";
import { extractTransactions } from "../services/openrouter";
import { createExpense, createSale, getBusinessProfile } from "../services/database";
import { AppError } from "../lib/errors";
import { parseBusinessMessage, parseExpenseLocally } from "../lib/localParse";
import type { AiChatResult, CurrencyCode } from "../types/transaction";

const router = Router();

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  categories: z.array(z.string().min(1).max(64)).max(40).optional(),
});

router.post(
  "/chat-expense",
  chatExpenseLimiter,
  requireAuth,
  requireSubscription,
  async (req, res, next) => {
    try {
      const { userId, profile } = req as AuthedRequest;
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "message is required");
      }

      const biz = await getBusinessProfile(userId);
      if (!biz) {
        res.json({
          action: "clarify",
          summary: "Set up your business profile first, then I can log sales and expenses.",
          transactions: [],
        });
        return;
      }

      const currency = profile.preferred_currency as CurrencyCode;
      const categories = parsed.data.categories ?? [];
      const business = parseBusinessMessage(parsed.data.message);
      const looksLikeSale =
        business?.intent === "sale" ||
        business?.intent === "debtor" ||
        /\b(sold|sale|sales|received from)\b/i.test(parsed.data.message);

      let ai: AiChatResult;
      try {
        if (business) {
          ai = {
            action: "create",
            summary: business.summary,
            items: business.items.map((item) => ({
              amount: item.amount,
              currency,
              category: item.category || item.item_or_service || "Other",
              merchant: item.customer_name || item.item_or_service || "Unknown",
              type: business.intent === "expense" ? "expense" : "income",
              payment_method: item.payment_method || "",
              notes: item.notes,
            })),
          };
        } else {
          ai = await extractTransactions(parsed.data.message, currency, categories);
        }
      } catch (aiErr) {
        const local = parseExpenseLocally(parsed.data.message, currency, categories);
        if (!local) throw aiErr;
        ai = {
          action: "create",
          summary: local.summary,
          items: local.items,
        };
      }

      if (ai.action === "clarify" || !ai.items.length) {
        res.json({
          action: "clarify",
          summary: ai.summary || "I didn't find a sale or expense to log.",
          transactions: [],
        });
        return;
      }

      const item = ai.items[0];
      if (looksLikeSale || item.type === "income") {
        const sale = await createSale(userId, {
          amount: item.amount,
          item_or_service: item.merchant || item.category,
          payment_method: /pos/i.test(item.payment_method)
            ? "pos"
            : /transfer/i.test(item.payment_method)
              ? "transfer"
              : /credit/i.test(item.payment_method)
                ? "credit"
                : "cash",
          notes: item.notes,
        });
        res.json({ action: "create", summary: ai.summary, sale });
        return;
      }

      const expense = await createExpense(userId, {
        amount: item.amount,
        category: item.category || "Miscellaneous",
        payment_method: /pos/i.test(item.payment_method)
          ? "pos"
          : /transfer/i.test(item.payment_method)
            ? "transfer"
            : "cash",
        notes: item.notes,
      });
      res.json({ action: "create", summary: ai.summary, expense });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

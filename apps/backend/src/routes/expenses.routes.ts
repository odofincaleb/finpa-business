import { Router } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { AppError } from "../lib/errors";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenseCategories,
  listExpenses,
  updateExpense,
} from "../services/database";

const router = Router();

const writeSchema = z.object({
  amount: z.number().positive(),
  category: z.string().max(80).optional(),
  payment_method: z.enum(["cash", "pos", "transfer", "credit"]).optional(),
  notes: z.string().max(500).optional().nullable(),
  incurred_at: z.string().optional(),
  client_id: z.string().max(80).optional().nullable(),
});

router.get("/categories", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const categories = await listExpenseCategories(userId);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = writeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid expense");
    const expense = await createExpense(userId, parsed.data);
    res.status(201).json({ expense, client_id: parsed.data.client_id ?? null });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const expenses = await listExpenses(userId, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ expenses });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const expense = await getExpense(userId, req.params.id);
    res.json({ expense });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = writeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid expense update");
    const expense = await updateExpense(userId, req.params.id, parsed.data);
    res.json({ expense });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    await deleteExpense(userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { AppError } from "../lib/errors";
import {
  addDebtorPayment,
  createDebtor,
  deleteDebtor,
  getDebtorWithPayments,
  listDebtors,
  updateDebtor,
} from "../services/database";

const router = Router();

const writeSchema = z.object({
  customer_name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  total_amount: z.number().nonnegative(),
  amount_paid: z.number().nonnegative().optional(),
  due_date: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(300).optional().nullable(),
});

router.post("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = writeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid debtor");
    const debtor = await createDebtor(userId, parsed.data);
    res.status(201).json({ debtor });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const status =
      req.query.status === "open" || req.query.status === "paid" || req.query.status === "all"
        ? req.query.status
        : "all";
    const debtors = await listDebtors(userId, status);
    res.json({ debtors });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const result = await getDebtorWithPayments(userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = writeSchema.partial().extend({
      status: z.enum(["open", "paid", "partial"]).optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid debtor update");
    const debtor = await updateDebtor(userId, req.params.id, parsed.data);
    res.json({ debtor });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/payments", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "amount is required");
    const result = await addDebtorPayment(
      userId,
      req.params.id,
      parsed.data.amount,
      parsed.data.note,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    await deleteDebtor(userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

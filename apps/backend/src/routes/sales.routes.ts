import { Router } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { createSale, deleteSale, getSale, listSales, updateSale } from "../services/database";

const router = Router();

const writeSchema = z.object({
  amount: z.number().positive(),
  item_or_service: z.string().max(200).optional(),
  payment_method: z.enum(["cash", "pos", "transfer", "credit"]).optional(),
  customer_name: z.string().max(120).optional().nullable(),
  quantity: z.number().int().positive().optional(),
  unit_price: z.number().nonnegative().optional().nullable(),
  sold_at: z.string().optional(),
  notes: z.string().max(500).optional().nullable(),
  client_id: z.string().max(80).optional().nullable(),
});

router.post("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = writeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid sale");
    const sale = await createSale(userId, parsed.data);
    res.status(201).json({ sale, client_id: parsed.data.client_id ?? null });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const sales = await listSales(userId, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ sales });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const sale = await getSale(userId, req.params.id);
    res.json({ sale });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = writeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid sale update");
    const sale = await updateSale(userId, req.params.id, parsed.data);
    res.json({ sale });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    await deleteSale(userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

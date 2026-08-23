import { Router } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { AppError } from "../lib/errors";
import {
  createBusinessProfile,
  getBusinessProfile,
  updateBusinessProfile,
} from "../services/database";

const router = Router();

const createSchema = z.object({
  business_name: z.string().min(1).max(120),
  business_type: z.string().max(80).optional().nullable(),
  currency: z.string().min(3).max(8).optional(),
});

router.post("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "business_name is required");
    }
    const profile = await createBusinessProfile(userId, {
      business_name: parsed.data.business_name,
      business_type: parsed.data.business_type,
      currency: parsed.data.currency || "NGN",
    });
    res.status(201).json({ profile });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const profile = await getBusinessProfile(userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.put("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid profile update");
    }
    const profile = await updateBusinessProfile(userId, parsed.data);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

export default router;

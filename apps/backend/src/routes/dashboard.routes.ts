import { Router } from "express";
import { AuthedRequest, requireAuth, requireSubscription } from "../middleware/auth";
import { getDashboard } from "../services/database";

const router = Router();

router.get("/", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const dashboard = await getDashboard(userId, "today");
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

router.get("/weekly", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const dashboard = await getDashboard(userId, "weekly");
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

router.get("/monthly", requireAuth, requireSubscription, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest;
    const dashboard = await getDashboard(userId, "monthly");
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

export default router;

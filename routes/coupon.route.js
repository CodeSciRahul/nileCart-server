import { Router } from "express";
import { validateCoupon } from "../controller/coupon.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/validate", optionalAuth, validateCoupon);

export default router;

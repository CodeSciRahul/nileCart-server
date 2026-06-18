import { Router } from "express";
import { validateCoupon, getPublicCoupons } from "../controller/coupon.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/active", getPublicCoupons);
router.post("/validate", optionalAuth, validateCoupon);

export default router;

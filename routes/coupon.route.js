import { Router } from "express";
import { validateCoupon } from "../controller/coupon.controller.js";

const router = Router();

router.post("/validate", validateCoupon);

export default router;

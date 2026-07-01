import { Router } from "express";
import {
  initializeCheckout,
  verifyCheckoutPayment,
  retryCheckout,
  getPaymentConfig,
} from "../controller/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/config", getPaymentConfig);

router.use(protect);
router.post("/checkout", initializeCheckout);
router.get("/verify", verifyCheckoutPayment);
router.post("/retry/:orderId", retryCheckout);

export default router;

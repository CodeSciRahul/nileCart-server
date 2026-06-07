import { Router } from "express";
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getOrderSummary,
} from "../controller/order.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/summary", getOrderSummary);

router.use(protect);
router.post("/", placeOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.patch("/:id/cancel", cancelOrder);

export default router;

import { Router } from "express";
import {
  getProductReviews,
  createReview,
  deleteReview,
} from "../controller/review.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/product/:productId", getProductReviews);
router.post("/", protect, createReview);
router.delete("/:id", protect, deleteReview);

export default router;

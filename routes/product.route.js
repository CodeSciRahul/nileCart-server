import { Router } from "express";
import {
  getProducts,
  getTrendingProducts,
  getProductBySlug,
  searchProducts,
  createProduct,
} from "../controller/product.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", getProducts);
router.get("/trending", getTrendingProducts);
router.get("/search", searchProducts);
router.get("/:slug", getProductBySlug);
router.post("/", protect, createProduct);

export default router;

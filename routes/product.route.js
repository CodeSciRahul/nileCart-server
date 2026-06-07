import { Router } from "express";
import {
  getProducts,
  getTrendingProducts,
  getProductBySlug,
  searchProducts,
  getMyProducts,
  getProductsByStoreSlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controller/product.controller.js";
import { protect, requireApprovedSeller } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", getProducts);
router.get("/trending", getTrendingProducts);
router.get("/search", searchProducts);
router.get("/mine", protect, requireApprovedSeller, getMyProducts);
router.get("/store/:slug", getProductsByStoreSlug);
router.get("/:slug", getProductBySlug);

router.post("/", protect, requireApprovedSeller, createProduct);
router.put("/:id", protect, requireApprovedSeller, updateProduct);
router.delete("/:id", protect, requireApprovedSeller, deleteProduct);

export default router;

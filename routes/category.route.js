import { Router } from "express";
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controller/category.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", getCategories);
router.get("/:slug", getCategoryBySlug);

router.post("/", protect, authorize("seller"), createCategory);
router.put("/:id", protect, authorize("seller"), updateCategory);
router.delete("/:id", protect, authorize("seller"), deleteCategory);

export default router;

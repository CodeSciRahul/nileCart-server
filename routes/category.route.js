import { Router } from "express";
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
} from "../controller/category.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", getCategories);
router.get("/:slug", getCategoryBySlug);
router.post("/", protect, createCategory);

export default router;

import { Router } from "express";
import {
  getCategories,
  getCategoryNavigation,
  getCategoryBySlug,
  getCategoryShop
} from "../controller/category.controller.js";

const router = Router();

router.get("/", getCategories);
router.get("/navigation", getCategoryNavigation);
router.get("/:slug/shop", getCategoryShop);
router.get("/:slug", getCategoryBySlug);

export default router;

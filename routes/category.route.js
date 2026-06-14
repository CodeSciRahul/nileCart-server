import { Router } from "express";
import {
  getCategories,
  getCategoryBySlug,
  getCategoryShop,
} from "../controller/category.controller.js";

const router = Router();

router.get("/", getCategories);
router.get("/:slug/shop", getCategoryShop);
router.get("/:slug", getCategoryBySlug);

export default router;

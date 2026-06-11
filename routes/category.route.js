import { Router } from "express";
import { getCategories, getCategoryBySlug } from "../controller/category.controller.js";

const router = Router();

router.get("/", getCategories);
router.get("/:slug", getCategoryBySlug);

export default router;

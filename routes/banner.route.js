import { Router } from "express";
import { getBanners } from "../controller/banner.controller.js";

const router = Router();

router.get("/", getBanners);

export default router;

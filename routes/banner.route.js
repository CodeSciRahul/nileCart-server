import { Router } from "express";
import {
  getBanners,
  getAnnouncements,
} from "../controller/banner.controller.js";

const router = Router();

router.get("/", getBanners);
router.get("/announcements", getAnnouncements);

export default router;

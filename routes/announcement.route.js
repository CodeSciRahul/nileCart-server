import { Router } from "express";
import {
  getAnnouncements,
  getAnnouncementById,
} from "../controller/announcement.controller.js";

const router = Router();

router.get("/", getAnnouncements);
router.get("/:id", getAnnouncementById);

export default router;

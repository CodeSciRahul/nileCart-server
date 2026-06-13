import { Router } from "express";
import {
  applyForSeller,
  getMySellerProfile,
  updateMySellerProfile,
  getSellerBySlug,
  getSellerById,
} from "../controller/seller.controller.js";
import { getSellerStats } from "../controller/admin.controller.js";
import { protect, authorize, requireSellerProfile, requireApprovedSeller } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/apply", protect, authorize("seller"), applyForSeller);
router.get("/me/profile", protect, requireSellerProfile, getMySellerProfile);
router.patch("/me/profile", protect, requireSellerProfile, updateMySellerProfile);
router.get("/me/stats", protect, requireApprovedSeller, getSellerStats);
router.get("/:slug", getSellerBySlug);
router.get("/:id", protect, getSellerById);

export default router;

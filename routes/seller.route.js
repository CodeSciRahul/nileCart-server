import { Router } from "express";
import {
  applyForSeller,
  getMySellerProfile,
  updateMySellerProfile,
  getSellerBySlug,
} from "../controller/seller.controller.js";
import { protect, authorize, requireSellerProfile } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/apply", protect, authorize("customer"), applyForSeller);
router.get("/me/profile", protect, requireSellerProfile, getMySellerProfile);
router.patch("/me/profile", protect, requireSellerProfile, updateMySellerProfile);
router.get("/:slug", getSellerBySlug);

export default router;

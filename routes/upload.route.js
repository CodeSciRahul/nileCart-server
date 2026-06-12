import { Router } from "express";
import { createPresignedUrl, deleteImage } from "../controller/upload.controller.js";
import { attachSellerProfile, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

/**
 * Presign route uses flexible seller attachment because upload types differ:
 * - profiles: any authenticated user
 * - store logos/banners: seller profile (pending OK)
 * - products: approved seller (enforced in service)
 * - platform banners: admin only (enforced in service)
 */
router.post("/presign", attachSellerProfile, createPresignedUrl);
router.delete("/delete", attachSellerProfile, deleteImage);
export default router;

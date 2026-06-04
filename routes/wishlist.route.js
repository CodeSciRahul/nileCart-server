import { Router } from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
} from "../controller/wishlist.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/", getWishlist);
router.post("/", addToWishlist);
router.post("/toggle", toggleWishlist);
router.delete("/:productId", removeFromWishlist);

export default router;

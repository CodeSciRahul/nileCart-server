import { Router } from "express";
import {
  login,
  loginSeller,
  loginAdmin,
  logout,
  getProfile,
  updateProfile,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/login/seller", loginSeller);
router.post("/login/admin", loginAdmin);
router.post("/logout", logout);
router.get("/me", protect, getProfile);
router.put("/me", protect, updateProfile);

export default router;

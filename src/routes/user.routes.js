import { Router } from "express";
import {
  login,
  loginSeller,
  loginAdmin,
  logout,
  getProfile,
  updateProfile,
  deleteAccount,
  lookupAuthMethods,
  setPassword,
  changePassword,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
} from "../controllers/user.controller.js";
import {
  sendSellerSignupOtp,
  verifySellerSignupOtp,
  registerSellerAccount,
  sendCustomerOtp,
  verifyCustomerOtp,
  sendDashboardOtp,
  verifyDashboardOtp,
} from "../controllers/otp.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/send-otp", sendCustomerOtp);
router.post("/verify-otp", verifyCustomerOtp);
router.post("/dashboard/send-otp", sendDashboardOtp);
router.post("/dashboard/verify-otp", verifyDashboardOtp);
router.post("/lookup", lookupAuthMethods);
router.post("/login", login);
router.post("/seller/register", registerSellerAccount);
router.post("/seller/send-otp", sendSellerSignupOtp);
router.post("/seller/verify-otp", verifySellerSignupOtp);
router.post("/login/seller", loginSeller);
router.post("/login/admin", loginAdmin);
router.post("/logout", logout);
router.post("/set-password", protect, setPassword);
router.post("/change-password", protect, changePassword);
router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot-password/reset", resetPassword);
router.get("/me", protect, getProfile);
router.put("/me", protect, updateProfile);
router.delete("/me", protect, deleteAccount);

export default router;

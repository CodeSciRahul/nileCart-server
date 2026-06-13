import { Router } from "express";
import {
  listSellers,
  getSellerById,
  approveSeller,
  rejectSeller,
  deactivateSeller,
} from "../controller/seller.controller.js";
import {
  listUsers,
  updateUserStatus,
  getAdminStats,
} from "../controller/admin.controller.js";
import {
  getAdminOrders,
  updateAdminOrderStatus,
} from "../controller/order.controller.js";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
} from "../controller/coupon.controller.js";
import {
  listBannersAdmin,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,
} from "../controller/banner.controller.js";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controller/category.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/stats", getAdminStats);

router.get("/sellers", listSellers);
router.get("/sellers/:id", getSellerById);
router.patch("/sellers/:id/approve", approveSeller);
router.patch("/sellers/:id/reject", rejectSeller);
router.patch("/sellers/:id/deactivate", deactivateSeller);

router.get("/users", listUsers);
router.patch("/users/:id/status", updateUserStatus);

router.get("/orders", getAdminOrders);
router.patch("/orders/:id/status", updateAdminOrderStatus);

router.get("/coupons", listCoupons);
router.post("/coupons", createCoupon);
router.put("/coupons/:id", updateCoupon);
router.patch("/coupons/:id/status", toggleCouponStatus);

router.get("/banners", listBannersAdmin);
router.post("/banners", createBanner);
router.put("/banners/:id", updateBanner);
router.patch("/banners/:id/status", toggleBannerStatus);
router.delete("/banners/:id", deleteBanner);

router.get("/categories", (req, res, next) => {
  req.query.includeInactive = "true";
  return getCategories(req, res, next);
});
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

export default router;

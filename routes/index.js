import { Router } from "express";
import userRoutes from "./user.route.js";
import categoryRoutes from "./category.route.js";
import productRoutes from "./product.route.js";
import bannerRoutes from "./banner.route.js";
import cartRoutes from "./cart.route.js";
import wishlistRoutes from "./wishlist.route.js";
import addressRoutes from "./address.route.js";
import orderRoutes from "./order.route.js";
import couponRoutes from "./coupon.route.js";
import reviewRoutes from "./review.route.js";
import sellerRoutes from "./seller.route.js";
import adminRoutes from "./admin.route.js";
import uploadRoutes from "./upload.route.js";

const router = Router();

router.use("/auth", userRoutes);
router.use("/users", userRoutes);
router.use("/sellers", sellerRoutes);
router.use("/admin", adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/banners", bannerRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/addresses", addressRoutes);
router.use("/orders", orderRoutes);
router.use("/coupons", couponRoutes);
router.use("/reviews", reviewRoutes);
router.use("/uploads", uploadRoutes);

router.get("/health", (req, res) => {
  res.json({ success: true, message: "LightCollection API is running" });
});

export default router;

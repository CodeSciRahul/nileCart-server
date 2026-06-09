import User from "../models/User.model.js";
import Seller from "../models/Seller.model.js";
import Order from "../models/Order.model.js";
import Coupon from "../models/Coupon.model.js";
import Banner from "../models/Banner.model.js";
import Product from "../models/Product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const getAdminStats = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    pendingSellers,
    totalSellers,
    ordersToday,
    activeCoupons,
    activeBanners,
    totalOrders,
  ] = await Promise.all([
    Seller.countDocuments({ approvalStatus: "Pending" }),
    Seller.countDocuments({ approvalStatus: "Approved" }),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Coupon.countDocuments({ isActive: true }),
    Banner.countDocuments({ isActive: true }),
    Order.countDocuments(),
  ]);

  sendSuccess(res, {
    stats: {
      pendingSellers,
      totalSellers,
      ordersToday,
      activeCoupons,
      activeBanners,
      totalOrders,
    },
  });
});

export const getSellerStats = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const productIds = await Product.find({ seller: sellerId }).select("_id");
  const ids = productIds.map((p) => p._id);

  const [productCount, totalOrders, pendingOrders] = await Promise.all([
    Product.countDocuments({ seller: sellerId, isActive: true }),
    ids.length
      ? Order.countDocuments({ "items.product": { $in: ids } })
      : Promise.resolve(0),
    ids.length
      ? Order.countDocuments({
          "items.product": { $in: ids },
          orderStatus: { $in: ["placed", "confirmed", "packed", "shipped"] },
        })
      : Promise.resolve(0),
  ]);

  sendSuccess(res, {
    stats: { productCount, totalOrders, pendingOrders },
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const filter = {};
  if (role) filter.role = role;

  const users = await User.find(filter)
    .select("name email mobileNumber role isActive createdAt")
    .sort("-createdAt");

  sendSuccess(res, { users });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return sendError(res, "User not found", 404);
  }

  if (user.role === "admin") {
    return sendError(res, "Cannot modify admin account status", 403);
  }

  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    return sendError(res, "isActive must be a boolean");
  }

  user.isActive = isActive;
  await user.save();

  sendSuccess(res, { user, message: `User ${isActive ? "activated" : "deactivated"}` });
});

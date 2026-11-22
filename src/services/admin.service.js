import * as UserRepository from "../repositories/user.repository.js";
import * as SellerRepository from "../repositories/seller.repository.js";
import * as OrderRepository from "../repositories/order.repository.js";
import * as CouponRepository from "../repositories/coupon.repository.js";
import * as BannerRepository from "../repositories/banner.repository.js";
import * as ProductRepository from "../repositories/product.repository.js";
import { createError } from "../utils/AppError.js";

export const getAdminStats = async () => {
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
    SellerRepository.countDocuments({ approvalStatus: "Pending" }),
    SellerRepository.countDocuments({ approvalStatus: "Approved" }),
    OrderRepository.countDocuments({ createdAt: { $gte: startOfDay } }),
    CouponRepository.find({ isActive: true }).countDocuments(),
    BannerRepository.find({ isActive: true }).countDocuments(),
    OrderRepository.countDocuments({}),
  ]);

  return {
    stats: {
      pendingSellers,
      totalSellers,
      ordersToday,
      activeCoupons,
      activeBanners,
      totalOrders,
    },
  };
};

export const getSellerStats = async (sellerId) => {
  const productIds = await ProductRepository.findBySeller(sellerId).select("_id");
  const ids = productIds.map((p) => p._id);

  const [productCount, totalOrders, pendingOrders] = await Promise.all([
    ProductRepository.countDocuments({ seller: sellerId, isActive: true }),
    ids.length
      ? OrderRepository.countDocuments({ "items.product": { $in: ids } })
      : Promise.resolve(0),
    ids.length
      ? OrderRepository.countDocuments({
          "items.product": { $in: ids },
          orderStatus: { $in: ["placed", "confirmed", "packed", "shipped"] },
        })
      : Promise.resolve(0),
  ]);

  return {
    stats: { productCount, totalOrders, pendingOrders },
  };
};

export const listUsers = async (role, query = {}) => {
  const filter = {};
  if (role) filter.role = role;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const total = await UserRepository.countDocuments(filter);

  let queryBuilder = UserRepository.find(filter)
    .select("name email mobileNumber role isActive createdAt")
    .sort("-createdAt");

  if (query.page || query.limit) {
    queryBuilder = queryBuilder.skip(skip).limit(limit);
  }

  const users = await queryBuilder;

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const updateUserStatus = async (userId, isActive) => {
  const user = await UserRepository.findById(userId);
  if (!user) throw createError("User not found", 404);

  if (user.role === "admin") {
    throw createError("Cannot modify admin account status", 403);
  }

  if (typeof isActive !== "boolean") {
    throw createError("isActive must be a boolean");
  }

  user.isActive = isActive;
  await user.save();

  return { user, message: `User ${isActive ? "activated" : "deactivated"}` };
};

import Order from "../models/Order.model.js";
import CouponRedemption from "../models/CouponRedemption.model.js";
import { findVariant } from "./productHelpers.js";

const couponError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

export const calculateCouponDiscount = (coupon, amount) => {
  if (!coupon?.isActive || amount <= 0) return 0;

  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (amount * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.discountValue;
  }

  return Math.min(discount, amount);
};

const isItemEligibleForCoupon = (item, coupon) => {
  const product = item.product;
  if (!product?.isActive) return false;

  const variant = findVariant(product, item.variantSku);
  if (!variant || variant.stock < item.quantity) return false;

  if (coupon.sponsoredBy === "seller" && coupon.seller) {
    if (String(product.seller) !== String(coupon.seller)) return false;
  }

  if (coupon.applicableProducts?.length) {
    const allowed = coupon.applicableProducts.map(String);
    if (!allowed.includes(String(product._id))) return false;
  }

  if (coupon.applicableCategories?.length) {
    const allowed = coupon.applicableCategories.map(String);
    if (!allowed.includes(String(product.category))) return false;
  }

  return true;
};

export const calculateEligibleSubtotal = (items, coupon = null) => {
  let subtotal = 0;

  for (const item of items) {
    if (coupon && !isItemEligibleForCoupon(item, coupon)) continue;

    const product = item.product;
    if (!product?.isActive) continue;

    const variant = findVariant(product, item.variantSku);
    if (!variant || variant.stock < item.quantity) continue;

    subtotal += variant.price * item.quantity;
  }

  return subtotal;
};

const assertCouponSchedule = (coupon) => {
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw couponError("Coupon not yet active");
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    throw couponError("Coupon expired");
  }
};

const assertGlobalUsage = (coupon) => {
  if (coupon?.usageLimit && coupon?.usedCount >= coupon?.usageLimit) {
    throw couponError("Coupon usage limit reached");
  }
};

const assertPerUserUsage = async (coupon, userId) => {
  if (!userId) return;

  const userUses = await CouponRedemption.countDocuments({
    user: userId,
    coupon: coupon._id,
    status: "applied",
  });

  if (userUses >= (coupon.maxUsesPerUser ?? 1)) {
    throw couponError("You have already used this coupon");
  }
};

const assertUserEligibility = async (coupon, userId) => {
  if (!userId || coupon?.eligibleUserType === "all") return;

  const deliveredCount = await Order.countDocuments({
    user: userId,
  });

  if (coupon?.eligibleUserType === "new" && deliveredCount > 0) {
    throw couponError("This coupon is only for first-time customers's orders");
  }

  if (coupon?.eligibleUserType === "returning" && deliveredCount === 0) {
    throw couponError("This coupon is only for returning customers's orders");
  }
};

export const assertCouponForUser = async (coupon, userId) => {
  if (!coupon?.isActive) {
    throw couponError("Invalid coupon", 404);
  }

  assertCouponSchedule(coupon); // check if the coupon is active and not expired
  assertGlobalUsage(coupon); // check if the coupon has reached its usage limit
  await assertPerUserUsage(coupon, userId); // check if the user has reached its usage limit
  await assertUserEligibility(coupon, userId); // check if the user is eligible for the coupon
};

export const assertCouponUsable = async (coupon, { userId, items }) => {
  await assertCouponForUser(coupon, userId);

  const eligibleSubtotal = calculateEligibleSubtotal(items, coupon);

  if (eligibleSubtotal <= 0) {
    throw couponError("This coupon is not applicable to items in your cart");
  }

  if (eligibleSubtotal < (coupon.minOrderAmount || 0)) {
    throw couponError(`Minimum order amount is ₹${coupon.minOrderAmount}`);
  }

  return eligibleSubtotal;
};

export const resolveCouponDiscount = async (coupon, { userId, items }) => {
  const eligibleSubtotal = await assertCouponUsable(coupon, { userId, items });
  return {
    eligibleSubtotal,
    discount: calculateCouponDiscount(coupon, eligibleSubtotal),
  };
};

export const recordCouponRedemption = async ({
  userId,
  coupon,
  orderId,
  discountAmount,
}) => {
  await CouponRedemption.create({
    user: userId,
    coupon: coupon._id,
    order: orderId,
    status: "applied",
    discountAmount,
  });

  coupon.usedCount += 1;
  await coupon.save();
};

export const restoreCouponOnCancel = async (order) => {
  if (!order.couponCode) return;

  const redemption = await CouponRedemption.findOne({
    order: order._id,
    status: "applied",
  }).populate("coupon");

  if (!redemption?.coupon) return;

  const coupon = redemption.coupon;
  if (!coupon.restoreOnCancel) return;

  redemption.status = "cancelled";
  await redemption.save();

  coupon.usedCount = Math.max(0, coupon.usedCount - 1);
  await coupon.save();
};

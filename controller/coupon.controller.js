import Coupon from "../models/Coupon.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import {
  assertCouponForUser,
  calculateCouponDiscount,
} from "../utils/couponHelpers.js";

const couponErrorResponse = (res, err) =>
  sendError(res, err.message, err.statusCode || 400);

export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, orderAmount = 0 } = req.body;
  const coupon = await Coupon.findOne({
    code: code?.toUpperCase(),
    isActive: true,
  });

  if (!coupon) return sendError(res, "Invalid coupon code", 404);

  try {
    if (req.user) {
      await assertCouponForUser(coupon, req.user._id);
    } else {
      const now = new Date();
      if (coupon.startsAt && coupon.startsAt > now) {
        return sendError(res, "Coupon not yet active");
      }
      if (coupon.endsAt && coupon.endsAt < now) {
        return sendError(res, "Coupon expired");
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return sendError(res, "Coupon usage limit reached");
      }
    }

    if (orderAmount < (coupon.minOrderAmount || 0)) {
      return sendError(
        res,
        `Minimum order amount is ₹${coupon.minOrderAmount}`
      );
    }
  } catch (err) {
    return couponErrorResponse(res, err);
  }

  const discount = calculateCouponDiscount(coupon, orderAmount);

  sendSuccess(res, {
    coupon: {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxUsesPerUser: coupon.maxUsesPerUser,
      eligibleUserType: coupon.eligibleUserType,
    },
    discount: Math.min(discount, orderAmount),
  });
});

export const listCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort("-createdAt");
  sendSuccess(res, { coupons });
});

export const getPublicCoupons = asyncHandler(async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    sponsoredBy: "platform",
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .select(
      "code description discountType discountValue minOrderAmount maxDiscount eligibleUserType maxUsesPerUser usageLimit usedCount"
    )
    .sort("-createdAt");

  const available = coupons.filter(
    (coupon) => !coupon.usageLimit || coupon.usedCount < coupon.usageLimit
  );

  sendSuccess(res, { coupons: available });
});

const buildCouponPayload = (body) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    usageLimit,
    maxUsesPerUser,
    restoreOnCancel,
    eligibleUserType,
    sponsoredBy,
    seller,
    applicableCategories,
    applicableProducts,
    startsAt,
    endsAt,
  } = body;

  return {
    code: code?.toUpperCase(),
    description,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    usageLimit,
    maxUsesPerUser,
    restoreOnCancel,
    eligibleUserType,
    sponsoredBy,
    seller,
    applicableCategories,
    applicableProducts,
    startsAt,
    endsAt,
  };
};

export const createCoupon = asyncHandler(async (req, res) => {
  const { code, discountType, discountValue } = req.body;

  if (!code || !discountType || discountValue === undefined) {
    return sendError(res, "code, discountType, and discountValue are required");
  }

  const coupon = await Coupon.create(buildCouponPayload(req.body));
  sendSuccess(res, { coupon }, 201);
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, "Coupon not found", 404);

  const allowed = [
    "description",
    "discountType",
    "discountValue",
    "minOrderAmount",
    "maxDiscount",
    "usageLimit",
    "maxUsesPerUser",
    "restoreOnCancel",
    "eligibleUserType",
    "sponsoredBy",
    "seller",
    "applicableCategories",
    "applicableProducts",
    "startsAt",
    "endsAt",
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) coupon[field] = req.body[field];
  });

  if (req.body.code) coupon.code = req.body.code.toUpperCase();

  if (req.body.seller !== undefined) {
    coupon.seller = req.body.seller || undefined;
  }

  await coupon.save();
  sendSuccess(res, { coupon });
});

export const toggleCouponStatus = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, "Coupon not found", 404);

  coupon.isActive =
    typeof req.body.isActive === "boolean" ? req.body.isActive : !coupon.isActive;
  await coupon.save();

  sendSuccess(res, { coupon });
});

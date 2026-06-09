import Coupon from "../models/Coupon.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, orderAmount = 0 } = req.body;
  const coupon = await Coupon.findOne({
    code: code?.toUpperCase(),
    isActive: true,
  });

  if (!coupon) return sendError(res, "Invalid coupon code", 404);

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
  if (orderAmount < (coupon.minOrderAmount || 0)) {
    return sendError(
      res,
      `Minimum order amount is ₹${coupon.minOrderAmount}`
    );
  }

  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (orderAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.discountValue;
  }

  sendSuccess(res, {
    coupon: {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
    discount: Math.min(discount, orderAmount),
  });
});

export const listCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort("-createdAt");
  sendSuccess(res, { coupons });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    usageLimit,
    startsAt,
    endsAt,
  } = req.body;

  if (!code || !discountType || discountValue === undefined) {
    return sendError(res, "code, discountType, and discountValue are required");
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase(),
    description,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    usageLimit,
    startsAt,
    endsAt,
  });

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
    "startsAt",
    "endsAt",
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) coupon[field] = req.body[field];
  });

  if (req.body.code) coupon.code = req.body.code.toUpperCase();

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

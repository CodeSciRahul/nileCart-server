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

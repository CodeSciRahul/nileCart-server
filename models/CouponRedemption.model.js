import mongoose from "mongoose";

const couponRedemptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    status: {
      type: String,
      enum: ["applied", "cancelled", "refunded"],
      default: "applied",
    },
    discountAmount: Number,
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ user: 1, coupon: 1, status: 1 });
couponRedemptionSchema.index({ coupon: 1, status: 1 });
couponRedemptionSchema.index({ order: 1 });

const CouponRedemption = mongoose.model("CouponRedemption", couponRedemptionSchema);
export default CouponRedemption;

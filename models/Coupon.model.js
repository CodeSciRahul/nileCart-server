import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: String,
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscount: Number,
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    maxUsesPerUser: {
      type: Number,
      default: 1,
      min: 1,
    },
    restoreOnCancel: {
      type: Boolean,
      default: false,
    },
    eligibleUserType: {
      type: String,
      enum: ["all", "new", "returning"],
      default: "all",
    },
    sponsoredBy: {
      type: String,
      enum: ["platform", "seller"],
      default: "platform",
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
    applicableCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    applicableProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    isActive: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true }
);

// couponSchema.pre("validate", function (next) {
//   if (this.sponsoredBy === "seller" && !this.seller) {
//     return next(new Error("Seller is required for seller-sponsored coupons"));
//   }
//   next();
// });

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;

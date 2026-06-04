import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variantSku: String,
  title: String,
  size: String,
  color: String,
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  mrp: Number,
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: String,
      mobileNumber: String,
      pincode: String,
      addressLine: String,
      locality: String,
      city: String,
      state: String,
      country: String,
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "upi", "card", "wallet"],
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "placed",
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    couponCode: String,
    statusHistory: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;

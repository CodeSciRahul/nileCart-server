import Order from "../models/Order.model.js";
import Product from "../models/Product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { FREE_SHIPPING_THRESHOLD } from "../utils/orderHelpers.js";
import { buildOrderFromCart } from "../utils/orderBuilder.js";
import { restoreOrderStock } from "../utils/paymentHelpers.js";
import { restoreCouponOnCancel } from "../utils/couponHelpers.js";

export const placeOrder = asyncHandler(async (req, res) => {
  const { paymentMethod = "cod" } = req.body;

  if (paymentMethod !== "cod") {
    return sendError(
      res,
      "Online payments must be initiated via POST /payments/checkout",
      400
    );
  }

  try {
    const order = await buildOrderFromCart(req.user._id, {
      addressId: req.body.addressId,
      paymentMethod: "cod",
    });
    sendSuccess(res, { order }, 201);
  } catch (err) {
    sendError(res, err.message, err.statusCode || 500);
  }
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const filter = { user: req.user._id };
  if (req.query.status) filter.orderStatus = req.query.status;

  const orders = await Order.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(filter);

  sendSuccess(res, {
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id,
  }).populate("items.product", "title slug images");

  if (!order) return sendError(res, "Order not found", 404);
  sendSuccess(res, { order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!order) return sendError(res, "Order not found", 404);

  if (order.paymentMethod === "card" && order.paymentStatus === "paid") {
    return sendError(
      res,
      "Paid online orders cannot be cancelled online. Please contact support.",
      400
    );
  }

  if (!["placed", "confirmed"].includes(order.orderStatus)) {
    return sendError(res, "Order cannot be cancelled at this stage");
  }

  await restoreOrderStock(order);

  order.orderStatus = "cancelled";
  order.cancelledAt = new Date();
  order.cancelReason = req.body.reason || "Cancelled by customer";
  order.statusHistory.push({
    status: "cancelled",
    note: order.cancelReason,
  });

  if (order.paymentMethod === "card" && order.paymentStatus === "pending") {
    order.paymentStatus = "failed";
  }

  await restoreCouponOnCancel(order);
  await order.save();
  sendSuccess(res, { order });
});

export const getOrderSummary = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    standardShippingFee: 79,
  });
});

const getSellerProductIds = async (sellerId) => {
  const products = await Product.find({ seller: sellerId }).select("_id");
  return products.map((p) => p._id);
};

const orderContainsSellerProducts = (order, productIds) =>
  order.items.some((item) =>
    productIds.some((id) => String(item.product?._id) === String(id))
  );

const SELLER_STATUS_FLOW = [
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export const getSellerOrders = asyncHandler(async (req, res) => {
  const productIds = await getSellerProductIds(req.seller._id);
  if (!productIds.length) {
    return sendSuccess(res, { orders: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const filter = { "items.product": { $in: productIds } };
  if (req.query.status) filter.orderStatus = req.query.status;

  const orders = await Order.find(filter)
    .populate("user", "name email")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(filter);

  sendSuccess(res, {
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getSellerOrderById = asyncHandler(async (req, res) => {
  const productIds = await getSellerProductIds(req.seller._id);
  const order = await Order.findById(req.params.id)
    .populate("user", "name email mobileNumber")
    .populate("items.product", "title slug seller");

  if (!order || !orderContainsSellerProducts(order, productIds)) {
    return sendError(res, "Order not found", 404);
  }

  sendSuccess(res, { order });
});

export const updateSellerOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!status) return sendError(res, "Status is required");

  if (!SELLER_STATUS_FLOW.includes(status)) {
    return sendError(res, "Invalid status for seller update");
  }

  const productIds = await getSellerProductIds(req.seller._id);
  const order = await Order.findById(req.params.id);

  if (!order || !orderContainsSellerProducts(order, productIds)) {
    return sendError(res, "Order not found", 404);
  }

  if (order.orderStatus === "cancelled" || order.orderStatus === "returned") {
    return sendError(res, "Cannot update a cancelled or returned order");
  }

  if (
    order.paymentMethod === "card" &&
    order.paymentStatus !== "paid" &&
    status !== "cancelled"
  ) {
    return sendError(res, "Cannot fulfill an order with unpaid online payment", 400);
  }

  order.orderStatus = status;
  order.statusHistory.push({
    status,
    note: note || `Status updated to ${status} by seller`,
  });

  if (status === "delivered") {
    order.deliveredAt = new Date();
  }

  await order.save();
  sendSuccess(res, { order });
});

export const getAdminOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.orderStatus = req.query.status;

  const orders = await Order.find(filter)
    .populate("user", "name email")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(filter);

  sendSuccess(res, {
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const updateAdminOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!status) return sendError(res, "Status is required");

  const order = await Order.findById(req.params.id);
  if (!order) return sendError(res, "Order not found", 404);

  order.orderStatus = status;
  order.statusHistory.push({
    status,
    note: note || `Status updated to ${status} by admin`,
  });

  if (status === "delivered") order.deliveredAt = new Date();
  if (status === "cancelled") {
    order.cancelledAt = new Date();
    await restoreCouponOnCancel(order);
  }

  await order.save();
  sendSuccess(res, { order });
});

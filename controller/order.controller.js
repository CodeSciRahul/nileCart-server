import Order from "../models/Order.model.js";
import Cart from "../models/Cart.model.js";
import Product from "../models/Product.model.js";
import Address from "../models/Address.model.js";
import Coupon from "../models/Coupon.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { findVariant } from "../utils/productHelpers.js";
import {
  generateOrderNumber,
  calculateShippingFee,
  FREE_SHIPPING_THRESHOLD,
} from "../utils/orderHelpers.js";

const buildOrderFromCart = async (userId, { addressId, paymentMethod = "cod" }) => {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart?.items?.length) {
    throw Object.assign(new Error("Cart is empty"), { statusCode: 400 });
  }

  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw Object.assign(new Error("Shipping address is required"), { statusCode: 400 });
  }

  const coupon = cart.coupon ? await Coupon.findById(cart.coupon) : null;
  const orderItems = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const product = item.product;
    if (!product?.isActive) continue;

    const variant = findVariant(product, item.variantSku);
    if (!variant || variant.stock < item.quantity) {
      throw Object.assign(
        new Error(`${product.title} is out of stock`),
        { statusCode: 400 }
      );
    }

    const lineTotal = variant.price * item.quantity;
    subtotal += lineTotal;

    orderItems.push({
      product: product._id,
      variantSku: variant?.sku,
      title: product.title,
      size: variant.size,
      color: variant.color,
      image: variant.images?.[0] || product.images?.[0],
      quantity: item.quantity,
      price: variant.price,
      mrp: variant.mrp,
    });

    variant.stock -= item.quantity;
    await product.save();
  }

  if (!orderItems.length) {
    throw Object.assign(new Error("No valid items in cart"), { statusCode: 400 });
  }

  let discount = 0;
  let couponCode;
  if (coupon?.isActive && subtotal >= (coupon.minOrderAmount || 0)) {
    couponCode = coupon.code;
    if (coupon.discountType === "percentage") {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else {
      discount = coupon.discountValue;
    }
    discount = Math.min(discount, subtotal);
    coupon.usedCount += 1;
    await coupon.save();
  }

  const afterDiscount = subtotal - discount;
  const shippingFee = calculateShippingFee(afterDiscount);
  const total = afterDiscount + shippingFee;

  const order = await Order.create({
    user: userId,
    orderNumber: generateOrderNumber(),
    items: orderItems,
    shippingAddress: {
      fullName: address.fullName,
      mobileNumber: address.mobileNumber,
      pincode: address.pincode,
      addressLine: address.addressLine,
      locality: address.locality,
      city: address.city,
      state: address.state,
      country: address.country,
    },
    paymentMethod,
    subtotal,
    discount,
    shippingFee,
    total,
    couponCode,
    statusHistory: [{ status: "placed", note: "Order placed successfully" }],
  });

  cart.items = [];
  cart.coupon = undefined;
  await cart.save();

  return order;
};

export const placeOrder = asyncHandler(async (req, res) => {
  try {
    const order = await buildOrderFromCart(req.user._id, req.body);
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

  if (!["placed", "confirmed"].includes(order.orderStatus)) {
    return sendError(res, "Order cannot be cancelled at this stage");
  }

  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    const variant = findVariant(product, item.variantSku);
    if (variant) variant.stock += item.quantity;
    await product.save();
  }

  order.orderStatus = "cancelled";
  order.cancelledAt = new Date();
  order.cancelReason = req.body.reason || "Cancelled by customer";
  order.statusHistory.push({
    status: "cancelled",
    note: order.cancelReason,
  });

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
    productIds.some((id) => String(item.product) === String(id))
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
  if (status === "cancelled") order.cancelledAt = new Date();

  await order.save();
  sendSuccess(res, { order });
});

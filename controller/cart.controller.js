import Cart from "../models/Cart.model.js";
import Product from "../models/Product.model.js";
import Coupon from "../models/Coupon.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { findVariant } from "../utils/productHelpers.js";
import { FREE_SHIPPING_THRESHOLD } from "../utils/orderHelpers.js";

const populateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    select: "title slug images variants isActive",
  });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  return cart;
};

const calculateCartTotals = (items, coupon) => {
  let subtotal = 0;
  const validItems = [];

  for (const item of items) {
    const product = item.product;
    if (!product?.isActive) continue;

    const variant = findVariant(product, item.variantSku);
    if (!variant || variant.stock < item.quantity) continue;

    const lineTotal = variant.price * item.quantity;
    subtotal += lineTotal;
    validItems.push({
      ...item.toObject(),
      variant,
      lineTotal,
    });
  }

  let discount = 0;
  if (coupon?.isActive) {
    if (coupon.discountType === "percentage") {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else {
      discount = coupon.discountValue;
    }
    discount = Math.min(discount, subtotal);
  }

  const afterDiscount = subtotal - discount;
  const shippingFee = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : 79;
  const total = afterDiscount + shippingFee;

  return {
    // items: validItems,
    subtotal,
    discount,
    shippingFee,
    total,
    itemCount: validItems.reduce((n, i) => n + i.quantity, 0),
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  };
};

export const getCart = asyncHandler(async (req, res) => {
  const cart = await populateCart(req.user._id);
  const coupon = cart.coupon ? await Coupon.findById(cart.coupon) : null;
  const totals = calculateCartTotals(cart.items, coupon)
  sendSuccess(res, { cart, ...totals, coupon });
});

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantSku, quantity = 1 } = req.body;
  if (!productId || !variantSku) {
    return sendError(res, "productId and variantSku are required");
  }

  const product = await Product.findById(productId);
  if (!product?.isActive) return sendError(res, "Product not found", 404);

  const variant = findVariant(product, variantSku);
  if (!variant) return sendError(res, "Variant not found", 404);
  if (variant.stock < quantity) return sendError(res, "Insufficient stock");

  const cart = await populateCart(req.user._id);
  const existing = cart.items.find(
    (i) =>
      String(i.product?._id) === String(productId) &&
      String(i.variantSku) === String(variantSku)
  );
  console.log("cart", cart)
  console.log("existing", existing)

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ product: productId, variantSku, quantity });
  }

  await cart.save();
  const updated = await populateCart(req.user._id);
  const totals = calculateCartTotals(updated.items, null);

  sendSuccess(res, { cart: updated, ...totals }, 201);
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await populateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);

  if (!item) return sendError(res, "Cart item not found", 404);
  if (quantity < 1) {
    item.deleteOne();
  } else {
    item.quantity = quantity;
  }

  await cart.save();
  const updated = await populateCart(req.user._id);
  sendSuccess(res, { cart: updated, ...calculateCartTotals(updated.items, null) });
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const cart = await populateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) return sendError(res, "Cart item not found", 404);

  item.deleteOne();
  await cart.save();

  const updated = await populateCart(req.user._id);
  sendSuccess(res, { cart: updated, ...calculateCartTotals(updated.items, null) });
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await populateCart(req.user._id);
  cart.items = [];
  cart.coupon = undefined;
  await cart.save();
  sendSuccess(res, { cart });
});

export const applyCouponToCart = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const coupon = await Coupon.findOne({
    code: code?.toUpperCase(),
    isActive: true,
  });

  if (!coupon) return sendError(res, "Invalid coupon", 404);

  const cart = await populateCart(req.user._id);
  const totals = calculateCartTotals(cart.items, coupon);

  if (totals.subtotal < (coupon.minOrderAmount || 0)) {
    return sendError(
      res,
      `Minimum order amount is ₹${coupon.minOrderAmount}`
    );
  }

  cart.coupon = coupon._id;
  await cart.save();

  sendSuccess(res, { cart, ...totals, coupon });
});

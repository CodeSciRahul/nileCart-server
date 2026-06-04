import Wishlist from "../models/Wishlist.model.js";
import Product from "../models/Product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { formatProductCard } from "../utils/productHelpers.js";

const getOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [] });
  }
  return wishlist;
};

export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
    "products"
  );

  const products = (wishlist?.products || [])
    .filter((p) => p?.isActive)
    .map(formatProductCard);

  sendSuccess(res, { wishlist, products, count: products.length });
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product?.isActive) return sendError(res, "Product not found", 404);

  const wishlist = await getOrCreateWishlist(req.user._id);
  const exists = wishlist.products.some((id) => String(id) === String(productId));

  if (!exists) {
    wishlist.products.push(productId);
    await wishlist.save();
  }

  sendSuccess(res, { wishlist, message: "Added to wishlist" }, 201);
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);
  wishlist.products = wishlist.products.filter(
    (id) => String(id) !== String(req.params.productId)
  );
  await wishlist.save();
  sendSuccess(res, { wishlist, message: "Removed from wishlist" });
});

export const toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const wishlist = await getOrCreateWishlist(req.user._id);
  const index = wishlist.products.findIndex(
    (id) => String(id) === String(productId)
  );

  if (index >= 0) {
    wishlist.products.splice(index, 1);
    await wishlist.save();
    return sendSuccess(res, { inWishlist: false, wishlist });
  }

  const product = await Product.findById(productId);
  if (!product?.isActive) return sendError(res, "Product not found", 404);

  wishlist.products.push(productId);
  await wishlist.save();
  sendSuccess(res, { inWishlist: true, wishlist }, 201);
});

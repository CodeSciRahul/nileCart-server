import Product from "../models/Product.model.js";
import Category from "../models/Category.model.js";
import Seller from "../models/Seller.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { formatProductCard } from "../utils/productHelpers.js";
import {
  formatProductForDashboard,
  formatProductForPublic,
  normalizeProductPayload,
} from "../utils/storedImageHelpers.js";
import { slugify } from "../utils/userHelpers.js";

const buildProductFilter = async (query) => {
  const filter = { isActive: true };
  const {
    category,
    brand,
    gender,
    minPrice,
    maxPrice,
    isTrending,
    isNewArrival,
    isOnSale,
    search,
    seller,
  } = query;

  if (category) {
    const cat = await Category.findOne({
      $or: [{ slug: category }, { _id: category }],
      isActive: true,
    });
    if (cat) filter.category = cat._id;
  }

  if (brand) filter.brand = brand;
  if (gender) filter.gender = gender;
  if (seller) filter.seller = seller;
  if (isTrending === "true") filter.isTrending = true;
  if (isNewArrival === "true") filter.isNewArrival = true;
  if (isOnSale === "true") filter.isOnSale = true;

  if (search) {
    filter.$text = { $search: search };
  }

  return { filter, minPrice, maxPrice };
};

export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const skip = (page - 1) * limit;
  const sort = req.query.sort || "-createdAt";

  const { filter, minPrice, maxPrice } = await buildProductFilter(req.query);

  let products = await Product.find(filter)
    .populate("category", "name slug")
    .populate("seller", "storeName storeSlug logo")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  if (minPrice || maxPrice) {
    products = products.filter((p) => {
      const price = p.variants[0]?.price ?? 0;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });
  }

  const total = await Product.countDocuments(filter);

  sendSuccess(res, {
    products: products.map(formatProductCard),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getTrendingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit, 10) || 8);
  const products = await Product.find({ isActive: true, isTrending: true })
    .populate("category", "name slug")
    .populate("seller", "storeName storeSlug")
    .sort("-rating.average")
    .limit(limit);

  sendSuccess(res, { products: products.map(formatProductCard) });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    isActive: true,
  })
    .populate("category", "name slug")
    .populate("seller", "storeName storeSlug logo rating");

  if (!product) return sendError(res, "Product not found", 404);
  sendSuccess(res, { product: formatProductForPublic(product) });
});

export const searchProducts = asyncHandler(async (req, res) => {
  req.query.search = req.query.q || req.query.search;
  return getProducts(req, res);
});

export const getMyProducts = asyncHandler(async (req, res) => {
  const filter = { seller: req.seller._id };

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const products = await Product.find(filter)
    .populate("category", "name slug")
    .sort("-createdAt");

  sendSuccess(res, { products: products.map(formatProductForDashboard) });
});

export const createProduct = asyncHandler(async (req, res) => {
  const { title, category, variants, seller: sellerId, ...rest } = normalizeProductPayload(req.body);
  if (!title || !category || !variants?.length) {
    return sendError(res, "title, category, and variants are required");
  }

  let seller;

  if (req.user.role === "admin") {
    if (!sellerId) {
      return sendError(res, "seller ID is required when creating products as admin");
    }
    seller = await Seller.findOne({ _id: sellerId, approvalStatus: "Approved", isActive: true });
    if (!seller) {
      return sendError(res, "Valid approved seller not found", 404);
    }
  } else {
    seller = req.seller;
  }

  const product = await Product.create({
    title,
    slug: rest?.slug || slugify(title),
    category,
    seller: seller._id,
    variants,
    ...rest,
  });

  sendSuccess(res, { product: formatProductForDashboard(product) }, 201);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return sendError(res, "Product not found", 404);
  }

  if (req.user.role !== "admin" && String(product.seller) !== String(req.seller._id)) {
    return sendError(res, "You can only update your own products", 403);
  }

  const normalized = normalizeProductPayload(req.body);
  const blocked = ["seller", "_id", "slug"];

  Object.keys(normalized).forEach((key) => {
    if (!blocked.includes(key) && normalized[key] !== undefined) {
      product[key] = normalized[key];
    }
  });

  await product.save();
  sendSuccess(res, { product: formatProductForDashboard(product) });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return sendError(res, "Product not found", 404);
  }

  if (req.user.role !== "admin" && String(product.seller) !== String(req.seller._id)) {
    return sendError(res, "You can only delete your own products", 403);
  }

  product.isActive = false;
  await product.save();

  sendSuccess(res, { message: "Product deactivated" });
});

export const getProductsByStoreSlug = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({
    storeSlug: req.params.slug,
    approvalStatus: "Approved",
    isActive: true,
  });

  if (!seller) {
    return sendError(res, "Store not found", 404);
  }

  req.query.seller = seller._id;
  return getProducts(req, res);
});

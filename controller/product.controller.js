import Product from "../models/Product.model.js";
import Category from "../models/Category.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { formatProductCard } from "../utils/productHelpers.js";

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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
    // .populate("brand", "name slug")
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
    // .populate("brand", "name slug logo");

  if (!product) return sendError(res, "Product not found", 404);
  sendSuccess(res, { product });
});

export const searchProducts = asyncHandler(async (req, res) => {
  req.query.search = req.query.q || req.query.search;
  return getProducts(req, res);
});

export const createProduct = asyncHandler(async (req, res) => {
  const { title, category, variants, ...rest } = req.body;
  if (!title || !category || !variants?.length) {
    return sendError(res, "title, category, and variants are required");
  }

  const product = await Product.create({
    title,
    slug: rest?.slug || slugify(title),
    category,
    variants,
    ...rest,
  });

  sendSuccess(res, { product }, 201);
});

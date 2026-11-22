import * as ProductRepository from "../repositories/product.repository.js";
import * as CategoryRepository from "../repositories/category.repository.js";
import * as SellerRepository from "../repositories/seller.repository.js";
import { formatProductCard } from "../utils/helpers/productHelpers.js";
import {
  formatProductForDashboard,
  formatProductForPublic,
  normalizeProductPayload,
} from "../utils/helpers/storedImageHelpers.js";
import { slugify } from "../utils/helpers/userHelpers.js";
import { createError } from "../utils/AppError.js";
import * as InventoryEmail from "./inventoryEmail.service.js";

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
    const cat = await CategoryRepository.findOne({
      $or: [{ slug: category }, { _id: category }],
      isActive: true,
    });
    if (cat) filter.category = cat._id;
  }

  if (brand) filter.brand = brand;
  if (gender) {
    const gLower = String(gender).toLowerCase();
    if (gLower === "men") {
      filter.gender = { $in: ["Men", "Unisex"] };
    } else if (gLower === "women") {
      filter.gender = { $in: ["Women", "Unisex"] };
    } else if (gLower === "unisex") {
      filter.gender = "Unisex";
    } else {
      filter.gender = new RegExp(`^${gender}$`, "i");
    }
  }
  if (seller) filter.seller = seller;
  if (isTrending === "true") filter.isTrending = true;
  if (isNewArrival === "true") filter.isNewArrival = true;
  if (isOnSale === "true") filter.isOnSale = true;

  if (search) {
    filter.$text = { $search: search };
  }

  if (minPrice || maxPrice) {
    filter["variants.price"] = {};
    if (minPrice) filter["variants.price"].$gte = Number(minPrice);
    if (maxPrice) filter["variants.price"].$lte = Number(maxPrice);
  }

  return { filter, minPrice, maxPrice };
};

export const getProducts = async (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, parseInt(query.limit, 10) || 12);
  const skip = (page - 1) * limit;
  const sort = query.sort || "-createdAt";

  const { filter } = await buildProductFilter(query);

  const [products, total] = await Promise.all([
    ProductRepository.find(filter)
      .populate("category", "name slug")
      .populate("seller", "storeName storeSlug logo")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    ProductRepository.countDocuments(filter),
  ]);

  return {
    products: products.map(formatProductCard),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getTrendingProducts = async (query) => {
  const limit = Math.min(20, parseInt(query.limit, 10) || 8);
  const products = await ProductRepository.find({ isActive: true, isTrending: true })
    .populate("category", "name slug")
    .populate("seller", "storeName storeSlug")
    .sort("-rating.average")
    .limit(limit);

  return { products: products.map(formatProductCard) };
};

export const getProductBySlug = async (slug) => {
  const product = await ProductRepository.findOne({
    slug,
    isActive: true,
  })
    .populate("category", "name slug")
    .populate(
      "seller",
      "storeName storeSlug logo banner description rating approvalStatus address.city address.state"
    );

  if (!product) throw createError("Product not found", 404);
  return { product: formatProductForPublic(product) };
};

export const searchProducts = async (query) =>
  getProducts({ ...query, search: query.q || query.search });

export const getMyProducts = async (sellerId, query = {}) => {
  const filter = { seller: sellerId };

  if (query.isActive !== undefined && query.isActive !== "") {
    filter.isActive = query.isActive === "true";
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || (query.page ? 10 : 50));
  const skip = (page - 1) * limit;

  const total = await ProductRepository.countDocuments(filter);

  let queryBuilder = ProductRepository.find(filter)
    .populate("category", "name slug")
    .sort("-createdAt");

  if (query.page || query.limit) {
    queryBuilder = queryBuilder.skip(skip).limit(limit);
  }

  const products = await queryBuilder;

  return {
    products: products.map(formatProductForDashboard),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const createProduct = async (user, seller, body) => {
  const { title, category, variants, seller: sellerId, ...rest } = normalizeProductPayload(body);
  if (!title || !category || !variants?.length) {
    throw createError("title, category, and variants are required");
  }

  let resolvedSeller;

  if (user.role === "admin") {
    if (!sellerId) {
      throw createError("seller ID is required when creating products as admin");
    }
    resolvedSeller = await SellerRepository.findOne({
      _id: sellerId,
      approvalStatus: "Approved",
      isActive: true,
    });
    if (!resolvedSeller) {
      throw createError("Valid approved seller not found", 404);
    }
  } else {
    resolvedSeller = seller;
  }

  const product = await ProductRepository.create({
    title,
    slug: rest?.slug || slugify(title),
    category,
    seller: resolvedSeller._id,
    variants,
    ...rest,
  });

  return { product: formatProductForDashboard(product), __status: 201 };
};

export const updateProduct = async (user, seller, productId, body) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw createError("Product not found", 404);

  if (user.role !== "admin" && String(product.seller) !== String(seller._id)) {
    throw createError("You can only update your own products", 403);
  }

  const previousStockBySku = Object.fromEntries(
    (product.variants || []).map((v) => [v.sku, v.stock])
  );

  const normalized = normalizeProductPayload(body);
  const blocked = ["seller", "_id", "slug"];

  Object.keys(normalized).forEach((key) => {
    if (!blocked.includes(key) && normalized[key] !== undefined) {
      product[key] = normalized[key];
    }
  });

  await product.save();

  await InventoryEmail.notifyProductVariantStockChanges(
    product,
    previousStockBySku
  );

  return { product: formatProductForDashboard(product) };
};

export const deleteProduct = async (user, seller, productId) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw createError("Product not found", 404);

  if (user.role !== "admin" && String(product.seller) !== String(seller._id)) {
    throw createError("You can only delete your own products", 403);
  }

  product.isActive = false;
  await product.save();

  return { message: "Product deactivated" };
};

export const getProductsByStoreSlug = async (slug, query) => {
  const seller = await SellerRepository.findBySlug(slug);

  if (!seller) throw createError("Store not found", 404);

  return getProducts({ ...query, seller: seller._id });
};

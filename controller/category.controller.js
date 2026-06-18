import Category from "../models/Category.model.js";
import Product from "../models/Product.model.js";
import Brand from "../models/Brand.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { slugify } from "../utils/userHelpers.js";
import {
  buildCategoryTree,
  validateCategoryParent,
  deactivateCategoryChildren,
} from "../utils/categoryHelpers.js";
import { formatProductCard } from "../utils/productHelpers.js";
import {
  formatCategoryForDashboard,
  formatCategoryForPublic,
  normalizeStoredImage,
} from "../utils/storedImageHelpers.js";

const GENDER_BY_DEPARTMENT = {
  men: "Men",
  women: "Women",
};

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const collectShopFacets = (products) => {
  const brands = new Map();
  const sizes = new Set();
  const colors = new Set();
  let minPrice = Infinity;
  let maxPrice = 0;

  products.forEach((product) => {
    if (product.brand?.name) {
      brands.set(String(product.brand._id), {
        _id: product.brand._id,
        name: product.brand.name,
        slug: product.brand.slug,
      });
    }

    (product.variants || []).forEach((variant) => {
      if (variant.size) sizes.add(variant.size);
      if (variant.color) colors.add(variant.color);

      const price = variant.price ?? 0;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    });
  });

  return {
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name)),
    sizes: [...sizes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    colors: [...colors].sort((a, b) => a.localeCompare(b)),
    priceRange: {
      min: minPrice === Infinity ? 0 : minPrice,
      max: maxPrice || 0,
    },
  };
};

const resolveCategoryShopScope = async (slug) => {
  const category = await Category.findOne({ slug, isActive: true }).populate(
    "parent",
    "name slug"
  );

  if (!category) return null;

  const children = await Category.find({ parent: category._id, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .select("name slug image description displayOrder showInNav");

  const categoryIds = children.length
    ? [category._id, ...children.map((child) => child._id)]
    : [category._id];

  const filter = { isActive: true, category: { $in: categoryIds } };

  if (children.length && GENDER_BY_DEPARTMENT[category.slug]) {
    filter.gender = GENDER_BY_DEPARTMENT[category.slug];
  }

  return { category, children, filter };
};

const applyShopQueryFilters = async (baseFilter, query) => {
  const filter = { ...baseFilter };
  const { brand, size, color, isOnSale, isTrending } = query;

  const brandSlugs = splitCsv(brand);
  if (brandSlugs.length) {
    const brands = await Brand.find({ slug: { $in: brandSlugs }, isActive: true });
    if (brands.length) {
      filter.brand = { $in: brands.map((item) => item._id) };
    }
  }

  const sizes = splitCsv(size);
  if (sizes.length) {
    filter["variants.size"] = { $in: sizes };
  }

  const colors = splitCsv(color);
  if (colors.length) {
    filter["variants.color"] = { $in: colors };
  }

  if (isOnSale === "true") filter.isOnSale = true;
  if (isTrending === "true") filter.isTrending = true;

  return {
    filter,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
  };
};

const matchesPriceRange = (product, minPrice, maxPrice) => {
  const price = product.variants?.[0]?.price ?? 0;
  if (minPrice && price < Number(minPrice)) return false;
  if (maxPrice && price > Number(maxPrice)) return false;
  return true;
};

export const getCategories = asyncHandler(async (req, res) => {
  const { navOnly, includeInactive, tree, parentId, rootsOnly, subcategoriesOnly } = req.query;
  const filter = {};

  if (navOnly === "true") filter.showInNav = true;
  if (includeInactive !== "true") filter.isActive = true;

  if (parentId) {
    filter.parent = parentId;
  } else if (rootsOnly === "true") {
    filter.parent = null;
  }

  if (subcategoriesOnly === "true") {
    filter.parent = { $ne: null };
  }

  const categories = await Category.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .populate("parent", "name slug");

  const formatCategory =
    includeInactive === "true" ? formatCategoryForDashboard : formatCategoryForPublic;
  const formatted = categories.map(formatCategory);

  if (tree === "true") {
    return sendSuccess(res, { categories: buildCategoryTree(formatted) });
  }

  sendSuccess(res, { categories: formatted });
});

export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    slug: req.params.slug,
    isActive: true,
  }).populate("parent", "name slug");

  if (!category) return sendError(res, "Category not found", 404);

  const children = await Category.find({
    parent: category._id,
    isActive: true,
  })
    .sort({ displayOrder: 1, name: 1 })
    .select("name slug image description displayOrder showInNav");

  sendSuccess(res, {
    category: formatCategoryForPublic(category),
    children: children.map(formatCategoryForPublic),
  });
});

export const getCategoryShop = asyncHandler(async (req, res) => {
  const scope = await resolveCategoryShopScope(req.params.slug);
  if (!scope) return sendError(res, "Category not found", 404);

  const { category, children, filter: baseFilter } = scope;
  const { filter, minPrice, maxPrice } = await applyShopQueryFilters(baseFilter, req.query);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, parseInt(req.query.limit, 10) || 12);
  const skip = (page - 1) * limit;
  const sort = req.query.sort || "-createdAt";

  const facetProducts = await Product.find(baseFilter)
    .populate("brand", "name slug")
    .select("variants brand");

  const facets = collectShopFacets(facetProducts);

  let products = await Product.find(filter)
    .populate("category", "name slug")
    .populate("brand", "name slug")
    .populate("seller", "storeName storeSlug logo")
    .sort(sort);

  if (minPrice || maxPrice) {
    products = products.filter((product) => matchesPriceRange(product, minPrice, maxPrice));
  }

  const total = products.length;
  const paginatedProducts = products.slice(skip, skip + limit);

  sendSuccess(res, {
    category: formatCategoryForPublic(category),
    children: children.map(formatCategoryForPublic),
    facets,
    products: paginatedProducts.map(formatProductCard),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, image, description, parent, displayOrder, showInNav } = req.body;
  if (!name) return sendError(res, "Category name is required");

  const parentId = await validateCategoryParent(parent);

  const category = await Category.create({
    name,
    slug: slugify(name),
    image: normalizeStoredImage(image),
    description,
    parent: parentId,
    displayOrder,
    showInNav,
  });

  await category.populate("parent", "name slug");

  sendSuccess(res, { category: formatCategoryForDashboard(category) }, 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return sendError(res, "Category not found", 404);
  }

  if (req.body.parent !== undefined) {
    category.parent = await validateCategoryParent(req.body.parent, category._id);
  }

  const allowed = ["name", "image", "description", "displayOrder", "showInNav", "isActive"];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      category[field] =
        field === "image" ? normalizeStoredImage(req.body[field]) : req.body[field];
    }
  });

  if (req.body.name && !req.body.slug) {
    category.slug = slugify(req.body.name);
  }

  await category.save();
  await category.populate("parent", "name slug");

  sendSuccess(res, { category: formatCategoryForDashboard(category) });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return sendError(res, "Category not found", 404);
  }

  category.isActive = false;
  await category.save();

  if (!category.parent) {
    await deactivateCategoryChildren(category._id);
  }

  sendSuccess(res, { message: "Category deactivated" });
});
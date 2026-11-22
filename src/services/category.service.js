import * as CategoryRepository from "../repositories/category.repository.js";
import * as ProductRepository from "../repositories/product.repository.js";
import * as BrandRepository from "../repositories/brand.repository.js";
import { slugify } from "../utils/helpers/userHelpers.js";
import {
  buildCategoryTree,
  validateCategoryParent,
  deactivateCategoryChildren,
  resolveCategoryDepartment,
  buildDepartmentNavigation,
} from "../utils/helpers/categoryHelpers.js";
import { GENDER_BY_DEPARTMENT } from "../constants/enums.js";
import { formatProductCard } from "../utils/helpers/productHelpers.js";
import {
  formatCategoryForDashboard,
  formatCategoryForPublic,
  normalizeStoredImage,
} from "../utils/helpers/storedImageHelpers.js";
import { createError } from "../utils/AppError.js";

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
  if (slug === "all" || slug === "all-products") {
    const children = await CategoryRepository.find({ parent: null, isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .select("name slug image description displayOrder showInNav");

    return {
      category: {
        _id: "all",
        name: "All Products",
        slug,
        description: "Explore all products",
      },
      children,
      filter: { isActive: true },
    };
  }

  const category = await CategoryRepository.findOne({ slug, isActive: true }).populate(
    "parent",
    "name slug"
  );

  if (!category) return null;

  const children = await CategoryRepository.find({ parent: category._id, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .select("name slug image description displayOrder showInNav");

  const categoryIds = children.length
    ? [category._id, ...children.map((child) => child._id)]
    : [category._id];

  const filter = { isActive: true, category: { $in: categoryIds } };

  if (children.length) {
    const dept = category.department || category.slug;
    if (GENDER_BY_DEPARTMENT[dept]) {
      filter.gender = GENDER_BY_DEPARTMENT[dept];
    }
  }

  return { category, children, filter };
};

const applyShopQueryFilters = async (baseFilter, query) => {
  const filter = { ...baseFilter };
  const { brand, size, color, isOnSale, isTrending } = query;

  const brandSlugs = splitCsv(brand);
  if (brandSlugs.length) {
    const brands = await BrandRepository.find({ slug: { $in: brandSlugs }, isActive: true });
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

  if (query.minPrice || query.maxPrice) {
    filter["variants.price"] = {};
    if (query.minPrice) filter["variants.price"].$gte = Number(query.minPrice);
    if (query.maxPrice) filter["variants.price"].$lte = Number(query.maxPrice);
  }

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

export const getCategories = async (query) => {
  const {
    navOnly,
    includeInactive,
    tree,
    navigation,
    parentId,
    rootsOnly,
    subcategoriesOnly,
    department,
    departmentsOnly,
  } = query;

  if (navigation === "true") {
    const navCategories = await CategoryRepository.find({ isActive: true, showInNav: true })
      .sort({ displayOrder: 1, name: 1 })
      .populate("parent", "name slug");

    const formattedNav = navCategories.map(formatCategoryForPublic);
    return { departments: buildDepartmentNavigation(formattedNav) };
  }

  const filter = {};

  if (navOnly === "true") filter.showInNav = true;
  if (includeInactive !== "true") filter.isActive = true;

  if (department) filter.department = department;

  if (parentId) {
    filter.parent = parentId;
  } else if (rootsOnly === "true") {
    filter.parent = null;
  }

  if (departmentsOnly === "true") {
    filter.parent = null;
    filter.department = { $ne: null };
  }

  if (subcategoriesOnly === "true") {
    filter.parent = { $ne: null };
  }

  const categories = await CategoryRepository.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .populate("parent", "name slug");

  const formatCategory =
    includeInactive === "true" ? formatCategoryForDashboard : formatCategoryForPublic;
  const formatted = categories.map(formatCategory);

  if (tree === "true") {
    return { categories: buildCategoryTree(formatted) };
  }

  return { categories: formatted };
};

export const getCategoryNavigation = async () => {
  const categories = await CategoryRepository.find({ isActive: true, showInNav: true })
    .sort({ displayOrder: 1, name: 1 })
    .populate("parent", "name slug");

  const formatted = categories.map(formatCategoryForPublic);
  return { departments: buildDepartmentNavigation(formatted) };
};

export const getCategoryBySlug = async (slug) => {
  const category = await CategoryRepository.findOne({
    slug,
    isActive: true,
  }).populate("parent", "name slug");

  if (!category) throw createError("Category not found", 404);

  const children = await CategoryRepository.find({
    parent: category._id,
    isActive: true,
  })
    .sort({ displayOrder: 1, name: 1 })
    .select("name slug image description displayOrder showInNav");

  return {
    category: formatCategoryForPublic(category),
    children: children.map(formatCategoryForPublic),
  };
};

export const getCategoryShop = async (slug, query) => {
  const scope = await resolveCategoryShopScope(slug);
  if (!scope) {
    return {
      category: {
        _id: slug,
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        slug,
        description: "",
      },
      children: [],
      facets: {
        brands: [],
        sizes: [],
        colors: [],
        priceRange: { min: 0, max: 0 },
      },
      products: [],
      pagination: { page: 1, pages: 1, total: 0 },
    };
  }

  const { category, children, filter: baseFilter } = scope;
  const { filter, minPrice, maxPrice } = await applyShopQueryFilters(baseFilter, query);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(48, parseInt(query.limit, 10) || 12);
  const skip = (page - 1) * limit;
  const sort = query.sort || "-createdAt";

  const facetProducts = await ProductRepository.find(baseFilter)
    .populate("brand", "name slug")
    .select("variants brand");

  const facets = collectShopFacets(facetProducts);

  const [paginatedProducts, total] = await Promise.all([
    ProductRepository.find(filter)
      .populate("category", "name slug")
      .populate("brand", "name slug")
      .populate("seller", "storeName storeSlug logo")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    ProductRepository.countDocuments(filter),
  ]);

  return {
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
  };
};

export const createCategory = async (body) => {
  const { name, image, description, parent, displayOrder, showInNav, department } = body;
  if (!name) throw createError("Category name is required");

  const parentId = await validateCategoryParent(parent);
  const resolvedDepartment = await resolveCategoryDepartment(parentId, department);

  const category = await CategoryRepository.create({
    name,
    slug: slugify(name),
    image: normalizeStoredImage(image),
    description,
    parent: parentId,
    department: resolvedDepartment,
    displayOrder,
    showInNav,
  });

  await category.populate("parent", "name slug");

  return { category: formatCategoryForDashboard(category), __status: 201 };
};

export const updateCategory = async (categoryId, body) => {
  const category = await CategoryRepository.findById(categoryId);
  if (!category) throw createError("Category not found", 404);

  if (body.parent !== undefined) {
    category.parent = await validateCategoryParent(body.parent, category._id);
    category.department = await resolveCategoryDepartment(
      category.parent,
      body.department ?? category.department
    );
  } else if (body.department !== undefined && !category.parent) {
    category.department = await resolveCategoryDepartment(null, body.department);
  }

  const allowed = ["name", "image", "description", "displayOrder", "showInNav", "isActive"];

  allowed.forEach((field) => {
    if (body[field] !== undefined) {
      category[field] =
        field === "image" ? normalizeStoredImage(body[field]) : body[field];
    }
  });

  if (body.name && !body.slug) {
    category.slug = slugify(body.name);
  }

  await category.save();
  await category.populate("parent", "name slug");

  return { category: formatCategoryForDashboard(category) };
};

export const deleteCategory = async (categoryId) => {
  const category = await CategoryRepository.findById(categoryId);
  if (!category) throw createError("Category not found", 404);

  category.isActive = false;
  await category.save();

  if (!category.parent) {
    await deactivateCategoryChildren(category._id);
  }

  return { message: "Category deactivated" };
};

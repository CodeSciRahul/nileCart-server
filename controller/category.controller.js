import Category from "../models/Category.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { slugify } from "../utils/userHelpers.js";
import {
  buildCategoryTree,
  validateCategoryParent,
  deactivateCategoryChildren,
} from "../utils/categoryHelpers.js";
import {
  formatCategoryForDashboard,
  formatCategoryForPublic,
  normalizeStoredImage,
} from "../utils/storedImageHelpers.js";

export const getCategories = asyncHandler(async (req, res) => {
  const { navOnly, includeInactive, tree, parentId, rootsOnly } = req.query;
  const filter = {};

  if (navOnly === "true") filter.showInNav = true;
  if (includeInactive !== "true") filter.isActive = true;

  if (parentId) {
    filter.parent = parentId;
  } else if (rootsOnly === "true") {
    filter.parent = null;
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

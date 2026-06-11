import Category from "../models/Category.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { slugify } from "../utils/userHelpers.js";
import {
  buildCategoryTree,
  validateCategoryParent,
  deactivateCategoryChildren,
} from "../utils/categoryHelpers.js";

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

  if (tree === "true") {
    return sendSuccess(res, { categories: buildCategoryTree(categories) });
  }

  sendSuccess(res, { categories });
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

  sendSuccess(res, { category, children });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, image, description, parent, displayOrder, showInNav } = req.body;
  if (!name) return sendError(res, "Category name is required");

  const parentId = await validateCategoryParent(parent);

  const category = await Category.create({
    name,
    slug: slugify(name),
    image,
    description,
    parent: parentId,
    displayOrder,
    showInNav,
  });

  await category.populate("parent", "name slug");

  sendSuccess(res, { category }, 201);
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
      category[field] = req.body[field];
    }
  });

  if (req.body.name && !req.body.slug) {
    category.slug = slugify(req.body.name);
  }

  await category.save();
  await category.populate("parent", "name slug");

  sendSuccess(res, { category });
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

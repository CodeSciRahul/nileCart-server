import Category from "../models/Category.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getCategories = asyncHandler(async (req, res) => {
  const { navOnly } = req.query;
  const filter = { isActive: true };
  if (navOnly === "true") filter.showInNav = true;

  const categories = await Category.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .populate("parent", "name slug");

  sendSuccess(res, { categories });
});

export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    slug: req.params.slug,
    isActive: true,
  });

  if (!category) return sendError(res, "Category not found", 404);
  sendSuccess(res, { category });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, image, description, parent, displayOrder, showInNav } = req.body;
  if (!name) return sendError(res, "Category name is required");

  const category = await Category.create({
    name,
    slug: slugify(name),
    image,
    description,
    parent,
    displayOrder,
    showInNav,
  });

  sendSuccess(res, { category }, 201);
});

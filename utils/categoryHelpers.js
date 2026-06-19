import Category from "../models/Category.model.js";
import {
  DEPARTMENT_VALUES,
  DEPARTMENT_LABELS,
  DEPARTMENT_ORDER,
} from "../constants/departments.js";

const toPlain = (doc) => (doc?.toObject ? doc.toObject() : { ...doc });

export const buildCategoryTree = (categories) => {
  const nodes = categories.map((cat) => ({
    ...toPlain(cat),
    children: [],
  }));

  const byId = new Map(nodes.map((node) => [String(node._id), node]));
  const roots = [];

  nodes.forEach((node) => {
    const parentId = node.parent?._id || node.parent;

    if (parentId && byId.has(String(parentId))) {
      byId.get(String(parentId)).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (list) => {
    list.sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name)
    );
    list.forEach((node) => sortNodes(node.children));
    return list;
  };

  return sortNodes(roots);
};

export const normalizeParentId = (parent) => {
  if (parent === undefined) return undefined;
  if (parent === null || parent === "" || parent === "null") return null;
  return parent;
};

export const validateCategoryParent = async (parentId, categoryId = null) => {
  const normalizedParent = normalizeParentId(parentId);
  if (normalizedParent === undefined) return undefined;
  if (!normalizedParent) return null;

  if (categoryId && String(normalizedParent) === String(categoryId)) {
    const err = new Error("A category cannot be its own parent.");
    err.statusCode = 400;
    throw err;
  }

  const parent = await Category.findById(normalizedParent);
  if (!parent) {
    const err = new Error("Parent category not found.");
    err.statusCode = 404;
    throw err;
  }

  if (parent.parent) {
    const err = new Error(
      "Only two levels are supported. Select a top-level category as the parent."
    );
    err.statusCode = 400;
    throw err;
  }

  if (categoryId) {
    const childCount = await Category.countDocuments({
      parent: categoryId,
      isActive: true,
    });

    if (childCount > 0 && normalizedParent) {
      const err = new Error(
        "Categories with subcategories must remain top-level parents."
      );
      err.statusCode = 400;
      throw err;
    }
  }

  return normalizedParent;
};

export const deactivateCategoryChildren = async (parentId) => {
  await Category.updateMany({ parent: parentId }, { isActive: false });
};

export const resolveCategoryDepartment = async (parentId, department) => {
  const normalizedParent = normalizeParentId(parentId);

  if (normalizedParent) {
    const parent = await Category.findById(normalizedParent).select("department");
    if (!parent) {
      const err = new Error("Parent category not found.");
      err.statusCode = 404;
      throw err;
    }
    return parent.department || null;
  }

  if (!department) {
    const err = new Error("Department is required for top-level categories.");
    err.statusCode = 400;
    throw err;
  }

  if (!DEPARTMENT_VALUES.includes(department)) {
    const err = new Error(`Invalid department. Must be one of: ${DEPARTMENT_VALUES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  return department;
};

const formatNavSubcategory = (cat) => ({
  _id: cat._id,
  name: cat.name,
  slug: cat.slug,
  displayOrder: cat.displayOrder ?? 0,
});

const formatNavCategory = (cat) => ({
  _id: cat._id,
  name: cat.name,
  slug: cat.slug,
  displayOrder: cat.displayOrder ?? 0,
  subcategories: (cat.children || []).map(formatNavSubcategory),
});

/** Structured nav payload: departments → categories → subcategories. */
export const buildDepartmentNavigation = (categories) => {
  const tree = buildCategoryTree(categories);
  const seen = new Set();

  return tree
    .filter((node) => node.department)
    .filter((node) => {
      if (seen.has(node.department)) return false;
      seen.add(node.department);
      return true;
    })
    .sort(
      (a, b) =>
        DEPARTMENT_ORDER.indexOf(a.department) - DEPARTMENT_ORDER.indexOf(b.department) ||
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    )
    .map((dept) => ({
      _id: dept._id,
      name: dept.name,
      slug: dept.slug,
      department: dept.department,
      label: (DEPARTMENT_LABELS[dept.department] || dept.department).toUpperCase(),
      displayOrder: dept.displayOrder ?? 0,
      categories: (dept.children || []).map(formatNavCategory),
    }));
};

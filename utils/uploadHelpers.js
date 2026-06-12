import { randomUUID } from "crypto";

/** Allowed image MIME types for direct-to-S3 uploads. */
export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Upload "folders" map to S3 key prefixes for a multi-vendor marketplace.
 * Each folder type keeps assets isolated by seller or user id where appropriate.
 */
export const UPLOAD_FOLDERS = {
  PRODUCTS: "products",
  STORE_LOGOS: "store-logos",
  STORE_BANNERS: "store-banners",
  PROFILES: "profiles",
  PLATFORM_BANNERS: "platform-banners",
  CATEGORIES: "categories",
};

const SELLER_SCOPED_FOLDERS = new Set([
  UPLOAD_FOLDERS.PRODUCTS,
  UPLOAD_FOLDERS.STORE_LOGOS,
  UPLOAD_FOLDERS.STORE_BANNERS,
]);

const EXTENSION_TO_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Presigned PUT URLs expire after 5 minutes. */
export const PRESIGN_EXPIRES_IN_SECONDS = 300;

const normalizeContentType = (contentType) => contentType?.trim().toLowerCase();

const getExtensionFromFileName = (fileName) => {
  const parts = fileName?.trim().toLowerCase().split(".");
  if (parts.length < 2) return null;
  return parts.at(-1);
};

/**
 * Validates MIME type and ensures the file extension matches the declared content type.
 */
export const validateImageUpload = ({ contentType, fileName }) => {
  const normalizedType = normalizeContentType(contentType);

  if (!normalizedType || !ALLOWED_IMAGE_TYPES[normalizedType]) {
    return {
      valid: false,
      message: "Invalid file type. Allowed types: JPEG, JPG, PNG, WEBP.",
    };
  }

  const extension = getExtensionFromFileName(fileName);

  if (!extension) {
    return { valid: false, message: "File name must include a valid extension." };
  }

  const expectedMime = EXTENSION_TO_MIME[extension];

  if (!expectedMime || expectedMime !== normalizedType) {
    return {
      valid: false,
      message: "File extension does not match the provided content type.",
    };
  }

  return { valid: true, contentType: normalizedType, extension };
};

export const isValidUploadFolder = (folder) =>
  Object.values(UPLOAD_FOLDERS).includes(folder);

export const isSellerScopedFolder = (folder) => SELLER_SCOPED_FOLDERS.has(folder);

/**
 * Builds a unique, structured S3 object key.
 * Example: products/{sellerId}/{uuid}.jpg
 */
export const buildObjectKey = ({ folder, extension, userId, sellerId }) => {
  const fileId = randomUUID();
  const fileName = `${fileId}.${extension}`;

  switch (folder) {
    case UPLOAD_FOLDERS.PRODUCTS:
      return `products/${sellerId}/${fileName}`;
    case UPLOAD_FOLDERS.STORE_LOGOS:
      return `stores/logos/${sellerId}/${fileName}`;
    case UPLOAD_FOLDERS.STORE_BANNERS:
      return `stores/banners/${sellerId}/${fileName}`;
    case UPLOAD_FOLDERS.PROFILES:
      return `profiles/${userId}/${fileName}`;
    case UPLOAD_FOLDERS.PLATFORM_BANNERS:
      return `banners/${fileName}`;
    case UPLOAD_FOLDERS.CATEGORIES:
      return `categories/${fileName}`;
    default:
      return null;
  }
};

/**
 * Public URL for an uploaded object. Prefer CloudFront/custom domain when configured.
 */
export const buildPublicFileUrl = ({ key, bucketName, region, publicUrlBase }) => {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (publicUrlBase) {
    return `${publicUrlBase.replace(/\/$/, "")}/${encodedKey}`;
  }

  return `https://${bucketName}.s3.${region}.amazonaws.com/${encodedKey}`;
};

/**
 * Ensures the authenticated user may delete an object by its S3 key.
 * Key layout must match keys produced by buildObjectKey().
 */
export const assertCanDeleteObjectKey = ({ key, user, seller }) => {
  const trimmed = key?.trim();

  if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/")) {
    const err = new Error("Invalid object key.");
    err.statusCode = 400;
    throw err;
  }

  if (user.role === "admin") {
    return;
  }

  const userId = user._id.toString();
  const sellerId = seller?._id?.toString();
  const ownedIds = [sellerId, userId].filter(Boolean);

  if (trimmed.startsWith("profiles/")) {
    const ownerId = trimmed.split("/")[1];
    if (ownerId !== userId) {
      const err = new Error("You cannot delete this image.");
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (trimmed.startsWith("banners/") || trimmed.startsWith("categories/")) {
    const err = new Error("Admin access required to delete this image.");
    err.statusCode = 403;
    throw err;
  }

  if (trimmed.startsWith("products/")) {
    const pathOwnerId = trimmed.split("/")[1];
    if (!ownedIds.includes(pathOwnerId)) {
      const err = new Error("You cannot delete this image.");
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (trimmed.startsWith("stores/logos/") || trimmed.startsWith("stores/banners/")) {
    const pathOwnerId = trimmed.split("/")[2];
    if (!ownedIds.includes(pathOwnerId)) {
      const err = new Error("You cannot delete this image.");
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const err = new Error("Unsupported object key for deletion.");
  err.statusCode = 400;
  throw err;
};

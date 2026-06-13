/**
 * Helpers for { url, key } image objects stored in MongoDB.
 * Accepts legacy plain URL strings for backward compatibility.
 */

export const getImageUrl = (image) => {
  if (!image) return null;
  if (typeof image === "string") return image;
  return image.url || null;
};

export const getImageKey = (image) => {
  if (!image || typeof image === "string") return null;
  return image.key || null;
};

export const normalizeStoredImage = (input) => {
  if (!input) return null;

  if (typeof input === "string") {
    const url = input.trim();
    return url ? { url, key: undefined } : null;
  }

  if (typeof input === "object" && input.url?.trim()) {
    return {
      url: input.url.trim(),
      key: input.key?.trim() || undefined,
    };
  }

  return null;
};

export const normalizeStoredImages = (inputs) => {
  if (!Array.isArray(inputs)) return [];
  return inputs.map(normalizeStoredImage).filter(Boolean);
};

export const toPublicImageUrls = (images) =>
  (images || []).map(getImageUrl).filter(Boolean);

export const normalizeProductPayload = (payload = {}) => {
  const next = { ...payload };

  if (next.images !== undefined) {
    next.images = normalizeStoredImages(next.images);
  }

  if (Array.isArray(next.variants)) {
    next.variants = next.variants.map((variant) => ({
      ...variant,
      images:
        variant.images !== undefined
          ? normalizeStoredImages(variant.images)
          : variant.images,
    }));
  }

  return next;
};

export const formatProductForPublic = (product) => {
  const obj = product?.toObject ? product.toObject() : { ...product };

  return {
    ...obj,
    images: toPublicImageUrls(obj.images),
    variants: (obj.variants || []).map((variant) => ({
      ...variant,
      images: toPublicImageUrls(variant.images),
    })),
    seller: obj.seller
      ? {
          ...obj.seller,
          logo: getImageUrl(obj.seller.logo),
          banner: getImageUrl(obj.seller.banner),
        }
      : obj.seller,
  };
};

export const formatProductForDashboard = (product) => {
  const obj = product?.toObject ? product.toObject() : { ...product };

  return {
    ...obj,
    images: normalizeStoredImages(obj.images),
    variants: (obj.variants || []).map((variant) => ({
      ...variant,
      images: normalizeStoredImages(variant.images),
    })),
  };
};

export const formatSellerForPublic = (seller) => {
  const obj = seller?.toObject ? seller.toObject() : { ...seller };

  return {
    ...obj,
    logo: getImageUrl(obj.logo),
    banner: getImageUrl(obj.banner),
  };
};

const SELLER_DOCUMENT_KEYS = ["idProof", "businessProof", "addressProof"];

export const normalizeSellerDocuments = (documents) => {
  if (!documents || typeof documents !== "object") return undefined;

  const result = {};

  for (const key of SELLER_DOCUMENT_KEYS) {
    const image = normalizeStoredImage(documents[key]);
    if (image) result[key] = image;
  }

  return Object.keys(result).length ? result : undefined;
};

export const formatSellerDocumentsForDashboard = (documents) => {
  if (!documents || typeof documents !== "object") return undefined;

  const result = {};

  for (const key of SELLER_DOCUMENT_KEYS) {
    const image = normalizeStoredImage(documents[key]);
    if (image) result[key] = image;
  }

  return Object.keys(result).length ? result : undefined;
};

export const mergeSellerDocuments = (existing, incoming) => {
  if (!incoming || typeof incoming !== "object") return undefined;

  const base =
    existing?.toObject?.() ??
    (typeof existing === "object" ? { ...existing } : {});

  for (const key of SELLER_DOCUMENT_KEYS) {
    if (incoming[key] !== undefined) {
      const image = normalizeStoredImage(incoming[key]);
      if (image) base[key] = image;
      else delete base[key];
    }
  }

  return Object.keys(base).length ? base : undefined;
};

export const formatSellerForDashboard = (seller) => {
  const obj = seller?.toObject ? seller.toObject() : { ...seller };

  return {
    ...obj,
    logo: normalizeStoredImage(obj.logo),
    banner: normalizeStoredImage(obj.banner),
    documents: formatSellerDocumentsForDashboard(obj.documents),
  };
};

export const formatCategoryForPublic = (category) => {
  const obj = category?.toObject ? category.toObject() : { ...category };

  return {
    ...obj,
    image: getImageUrl(obj.image),
  };
};

export const formatCategoryForDashboard = (category) => {
  const obj = category?.toObject ? category.toObject() : { ...category };

  return {
    ...obj,
    image: normalizeStoredImage(obj.image),
  };
};

export const formatBannerForPublic = (banner) => {
  const obj = banner?.toObject ? banner.toObject() : { ...banner };

  return {
    ...obj,
    image: getImageUrl(obj.image),
  };
};

export const formatBannerForDashboard = (banner) => {
  const obj = banner?.toObject ? banner.toObject() : { ...banner };

  return {
    ...obj,
    image: normalizeStoredImage(obj.image),
  };
};

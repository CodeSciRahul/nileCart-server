/**
 * Helpers for { url, key } image objects stored in MongoDB.
 * Accepts legacy plain URL strings for backward compatibility.
 */

import { resolveDeepLink } from "./deepLinkHelpers.js";

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
  const ctaHref = resolveDeepLink(obj.deepLink, obj.ctaLink);

  return {
    _id: obj._id,
    title: obj.title,
    subtitle: obj.subtitle,
    description: obj.description,
    type: obj.type || "hero",
    image: getImageUrl(obj.image),
    mobileImage: getImageUrl(obj.mobileImage) || getImageUrl(obj.image),
    ctaText: obj.ctaText || "Shop Now",
    ctaLink: obj.ctaLink || null,
    ctaHref,
    deepLink: obj.deepLink || null,
    displayOrder: obj.displayOrder ?? 0,
    priority: obj.priority ?? 0,
    startsAt: obj.startsAt,
    endsAt: obj.endsAt,
  };
};

export const formatBannerForDashboard = (banner) => {
  const obj = banner?.toObject ? banner.toObject() : { ...banner };

  return {
    ...obj,
    type: obj.type || "hero",
    image: normalizeStoredImage(obj.image),
    mobileImage: normalizeStoredImage(obj.mobileImage),
    deepLink: obj.deepLink || null,
    targeting: obj.targeting || { devices: ["all"], auth: "all" },
    ctaHref: resolveDeepLink(obj.deepLink, obj.ctaLink),
  };
};

export const formatAnnouncementForPublic = (announcement) => {
  if (!announcement) return null;
  const obj = announcement?.toObject
    ? announcement.toObject()
    : { ...announcement };
  const href = resolveDeepLink(obj.deepLink, obj.link);

  return {
    _id: obj._id,
    message: obj.message,
    type: obj.type || "top_bar",
    backgroundColor: obj.backgroundColor || "#111111",
    textColor: obj.textColor || "#ffffff",
    priority: obj.priority ?? 0,
    dismissible: obj.dismissible !== false,
    link: obj.link || null,
    href,
    deepLink: obj.deepLink || null,
    startsAt: obj.startsAt,
    endsAt: obj.endsAt,
  };
};

export const formatAnnouncementForDashboard = (announcement) => {
  if (!announcement) return null;
  const obj = announcement?.toObject
    ? announcement.toObject()
    : { ...announcement };

  return {
    ...obj,
    type: obj.type || "top_bar",
    deepLink: obj.deepLink || null,
    targeting: obj.targeting || { devices: ["all"], auth: "all" },
    dismissible: obj.dismissible !== false,
    href: resolveDeepLink(obj.deepLink, obj.link),
  };
};

export const formatCampaignForPublic = (campaign) => {
  if (!campaign) return null;
  const obj = campaign?.toObject ? campaign.toObject() : { ...campaign };

  return {
    ...obj,
    image: getImageUrl(obj.image),
    mobileImage: getImageUrl(obj.mobileImage),
  };
};

export const formatCampaignForDashboard = (campaign) => {
  if (!campaign) return null;
  const obj = campaign?.toObject ? campaign.toObject() : { ...campaign };

  return {
    ...obj,
    image: normalizeStoredImage(obj.image),
    mobileImage: normalizeStoredImage(obj.mobileImage),
  };
};

export const formatCollectionForPublic = (collection) => {
  if (!collection) return null;
  const obj = collection?.toObject ? collection.toObject() : { ...collection };

  return {
    ...obj,
    image: getImageUrl(obj.image),
  };
};

export const formatCollectionForDashboard = (collection) => {
  if (!collection) return null;
  const obj = collection?.toObject ? collection.toObject() : { ...collection };

  return {
    ...obj,
    image: normalizeStoredImage(obj.image),
  };
};

export const formatFlashSaleForPublic = (flashSale) => {
  if (!flashSale) return null;
  const obj = flashSale?.toObject ? flashSale.toObject() : { ...flashSale };

  return {
    ...obj,
    image: getImageUrl(obj.image),
  };
};

export const formatFlashSaleForDashboard = (flashSale) => {
  if (!flashSale) return null;
  const obj = flashSale?.toObject ? flashSale.toObject() : { ...flashSale };

  return {
    ...obj,
    image: normalizeStoredImage(obj.image),
  };
};

export const formatBrandForPublic = (brand) => {
  if (!brand) return null;
  const obj = brand?.toObject ? brand.toObject() : { ...brand };

  return {
    ...obj,
    logo: getImageUrl(obj.logo),
  };
};

export const formatBrandForDashboard = (brand) => {
  if (!brand) return null;
  const obj = brand?.toObject ? brand.toObject() : { ...brand };

  return {
    ...obj,
    logo: normalizeStoredImage(obj.logo),
  };
};

export const formatHomeSectionForDashboard = (section) => {
  if (!section) return null;
  const obj = section?.toObject ? section.toObject() : { ...section };

  return {
    ...obj,
    image: normalizeStoredImage(obj.image),
    items: Array.isArray(obj.items)
      ? obj.items.map((item) => ({
          _id: item._id,
          title: item.title || "",
          subtitle: item.subtitle || "",
          caption: item.caption || "",
          price: item.price || "",
          kicker: item.kicker || "",
          link: item.link || "",
          displayOrder: item.displayOrder ?? 0,
          image: normalizeStoredImage(item.image),
        }))
      : [],
  };
};

export const formatHomeSectionForPublic = (section) => {
  if (!section) return null;
  const obj = section?.toObject ? section.toObject() : { ...section };

  return {
    _id: obj._id,
    key: obj.key,
    type: obj.type,
    title: obj.title,
    subtitle: obj.subtitle,
    description: obj.description,
    displayOrder: obj.displayOrder,
    isActive: obj.isActive ?? true,
    backgroundColor: obj.backgroundColor,
    textColor: obj.textColor,
    ctaText: obj.ctaText,
    ctaLink: obj.ctaLink,
    image: getImageUrl(obj.image),
    items: Array.isArray(obj.items)
      ? obj.items.map((item) => ({
          _id: item._id,
          title: item.title || "",
          subtitle: item.subtitle || "",
          caption: item.caption || "",
          price: item.price || "",
          kicker: item.kicker || "",
          link: item.link || "",
          displayOrder: item.displayOrder ?? 0,
          image: getImageUrl(item.image),
        }))
      : [],
    config: {
      layout: obj.config?.layout || "grid",
      limit: obj.config?.limit || 8,
      productSource: obj.config?.productSource,
      source: obj.config?.source,
      popupFrequency: obj.config?.popupFrequency,
      deepLink: obj.config?.deepLink,
    },
  };
};

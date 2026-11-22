import * as HomeSectionRepository from "../repositories/homeSection.repository.js";
import * as BannerRepository from "../repositories/banner.repository.js";
import * as AnnouncementRepository from "../repositories/announcement.repository.js";
import * as CampaignRepository from "../repositories/campaign.repository.js";
import * as FlashSaleRepository from "../repositories/flashSale.repository.js";
import * as CollectionRepository from "../repositories/collection.repository.js";
import * as CategoryRepository from "../repositories/category.repository.js";
import * as BrandRepository from "../repositories/brand.repository.js";
import * as ProductRepository from "../repositories/product.repository.js";
import { publicActiveFilter } from "../utils/helpers/scheduleHelpers.js";
import { formatProductCard } from "../utils/helpers/productHelpers.js";
import {
  formatBannerForPublic,
  formatAnnouncementForPublic,
  formatCampaignForPublic,
  formatCollectionForPublic,
  formatFlashSaleForPublic,
  formatBrandForPublic,
  formatCategoryForPublic,
  formatHomeSectionForPublic,
  formatHomeSectionForDashboard,
  normalizeStoredImage,
} from "../utils/helpers/storedImageHelpers.js";
import { filterByTargeting } from "../utils/helpers/targetingHelpers.js";
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTION_TYPES,
} from "../constants/homeSections.js";
import { createError } from "../utils/AppError.js";
import { slugify } from "../utils/helpers/userHelpers.js";

const toPlain = (doc) => (doc?.toObject ? doc.toObject() : doc);

const ensureDefaultSections = async () => {
  for (const s of DEFAULT_HOME_SECTIONS) {
    const exists = await HomeSectionRepository.findOne({ key: s.key });
    if (!exists) {
      await HomeSectionRepository.create(s);
    }
  }
};

const resolveProducts = async ({ productSource, productIds, limit = 8 }) => {
  const capped = Math.min(Math.max(Number(limit) || 8, 1), 48);
  let filter = { isActive: true };

  if (productSource === "trending") filter.isTrending = true;
  else if (productSource === "sale") filter.isOnSale = true;
  else if (productSource === "new") filter.isNewArrival = true;
  else if (productSource === "ids") {
    if (!productIds?.length) return [];
    filter._id = { $in: productIds };
  }

  let query = ProductRepository.find(filter)
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(capped);

  if (productSource === "ids" && productIds?.length) {
    const products = await query;
    const byId = new Map(products.map((p) => [String(p._id), p]));
    return productIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map(formatProductCard);
  }

  const products = await query.sort({ createdAt: -1 });
  return products.map(formatProductCard);
};

const resolveBanners = async (config = {}, audience = {}) => {
  const filter = publicActiveFilter();
  if (config.source === "selected" && config.bannerIds?.length) {
    filter._id = { $in: config.bannerIds };
  }

  const banners = await BannerRepository.find(filter).sort({
    displayOrder: 1,
    priority: -1,
  });
  let list = filterByTargeting(banners, audience).map(formatBannerForPublic);

  if (config.source === "selected" && config.bannerIds?.length) {
    const byId = new Map(list.map((b) => [String(b._id), b]));
    list = config.bannerIds.map((id) => byId.get(String(id))).filter(Boolean);
  }

  return list.slice(0, config.limit || 8);
};

const resolveCategories = async (config = {}) => {
  const limit = Math.min(Math.max(Number(config.limit) || 8, 1), 48);

  if (config.categoryIds?.length) {
    const categories = await CategoryRepository.find({
      _id: { $in: config.categoryIds },
      isActive: true,
    }).populate("parent", "name slug");

    const byId = new Map(categories.map((c) => [String(c._id), c]));
    return config.categoryIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map(formatCategoryForPublic);
  }

  const categories = await CategoryRepository.find({
    isActive: true,
    showInNav: true,
    parent: { $ne: null },
  })
    .populate("parent", "name slug")
    .sort({ displayOrder: 1 })
    .limit(limit);

  return categories.map(formatCategoryForPublic);
};

const resolveBrands = async (config = {}) => {
  const limit = Math.min(Math.max(Number(config.limit) || 12, 1), 48);
  const filter = { isActive: true };

  if (config.source === "selected" && config.brandIds?.length) {
    filter._id = { $in: config.brandIds };
  }

  const brands = await BrandRepository.find(filter).sort({ name: 1 }).limit(limit);
  return brands.map(formatBrandForPublic);
};

const resolveCampaign = async (section) => {
  const config = section.config || {};
  let campaign = null;

  if (config.campaignId) {
    campaign = await CampaignRepository.findOne({
      _id: config.campaignId,
      ...publicActiveFilter(),
    });
  }

  if (!campaign) {
    const preferredType =
      section.type === "seasonal_campaign"
        ? "seasonal"
        : section.type === "popup_campaign"
          ? "popup"
          : section.type === "custom_marketing"
            ? "custom"
            : "promotional";

    campaign = await CampaignRepository.find({
      type: preferredType,
      ...publicActiveFilter(),
    })
      .sort({ displayOrder: 1 })
      .limit(1)
      .then((rows) => rows[0] || null);
  }

  return formatCampaignForPublic(campaign);
};

const resolveFlashSale = async (section) => {
  const config = section.config || {};
  let flashSale = null;

  if (config.flashSaleId) {
    flashSale = await FlashSaleRepository.findOne({
      _id: config.flashSaleId,
      ...publicActiveFilter(),
    });
  }

  if (!flashSale) {
    flashSale = await FlashSaleRepository.find(publicActiveFilter())
      .sort({ displayOrder: 1, endsAt: 1 })
      .limit(1)
      .then((rows) => rows[0] || null);
  }

  if (!flashSale) return null;

  const formatted = formatFlashSaleForPublic(flashSale);
  const products = await resolveProducts({
    productSource: flashSale.productSource === "sale" ? "sale" : "ids",
    productIds: flashSale.productIds,
    limit: config.limit || 8,
  });

  return { ...formatted, products };
};

const resolveCollection = async (section) => {
  const config = section.config || {};
  let collection = null;

  if (config.collectionId) {
    collection = await CollectionRepository.findOne({
      _id: config.collectionId,
      ...publicActiveFilter(),
    });
  }

  if (!collection) {
    collection = await CollectionRepository.find(publicActiveFilter())
      .sort({ displayOrder: 1 })
      .limit(1)
      .then((rows) => rows[0] || null);
  }

  if (!collection) return null;

  const formatted = formatCollectionForPublic(collection);
  const products = await resolveProducts({
    productSource: "ids",
    productIds: collection.productIds,
    limit: config.limit || 8,
  });

  return { ...formatted, products };
};

const resolveSectionData = async (section, audience = {}) => {
  const config = toPlain(section.config) || {};

  switch (section.type) {
    case "hero_banner":
      return { banners: await resolveBanners(config, audience) };

    case "announcement_bar": {
      const filter = publicActiveFilter();
      if (config.announcementIds?.length) {
        filter._id = { $in: config.announcementIds };
      }
      const announcements = await AnnouncementRepository.find(filter).sort({
        priority: -1,
      });
      return {
        announcements: filterByTargeting(announcements, audience).map(
          formatAnnouncementForPublic
        ),
      };
    }

    case "promotional_campaign":
    case "seasonal_campaign":
    case "custom_marketing":
    case "popup_campaign": {
      const campaign = await resolveCampaign(section);
      return { campaign };
    }

    case "flash_sale": {
      const flashSale = await resolveFlashSale(section);
      return { flashSale };
    }

    case "category_highlights":
      return { categories: await resolveCategories(config) };

    case "brand_showcase":
      return { brands: await resolveBrands(config) };

    case "featured_collection": {
      const collection = await resolveCollection(section);
      return { collection };
    }

    case "recommended_products": {
      const products = await resolveProducts({
        productSource: config.productSource || "trending",
        productIds: config.productIds,
        limit: config.limit,
      });
      return { products };
    }

    default:
      return {};
  }
};

const isSectionRenderable = (section, data = {}) => {
  if (section.isActive === false) return false;

  switch (section.type) {
    case "hero_banner":
      return Boolean(data.banners?.length || section.image);
    case "announcement_bar":
      return Boolean(data.announcements?.length || section.title);
    case "special_offers":
    case "trending_cards":
      return Boolean((section.items && section.items.length > 0) || section.title || section.image);
    case "promotional_campaign":
    case "seasonal_campaign":
    case "custom_marketing":
    case "editorial_banner":
      return Boolean(data.campaign || section.image || section.title);
    case "popup_campaign":
      return Boolean(data.campaign);
    case "flash_sale":
      return Boolean(data.flashSale?.products?.length || section.title);
    case "category_highlights":
      return Boolean(data.categories?.length || section.title);
    case "brand_showcase":
      return Boolean(data.brands?.length || section.title);
    case "featured_collection":
      return Boolean(data.collection?.products?.length || section.title);
    case "recommended_products":
      return Boolean(data.products?.length || section.title);
    default:
      return Boolean(section.title || section.image || (section.items && section.items.length > 0));
  }
};

export const getHomePage = async (audience = {}) => {
  await ensureDefaultSections();

  const [announcements, sections] = await Promise.all([
    AnnouncementRepository.find(publicActiveFilter()).sort({
      priority: -1,
      createdAt: -1,
    }),
    HomeSectionRepository.find(publicActiveFilter()).sort({
      displayOrder: 1,
      createdAt: 1,
    }),
  ]);

  const matchedAnnouncements = filterByTargeting(announcements, audience);
  const announcement = matchedAnnouncements[0]
    ? formatAnnouncementForPublic(matchedAnnouncements[0])
    : null;

  const resolved = await Promise.all(
    sections.map(async (section) => {
      const data = await resolveSectionData(section, audience);
      return { section, data };
    })
  );

  const pageSections = [];
  let popup = null;

  for (const { section, data } of resolved) {
    if (!isSectionRenderable(section, data)) continue;

    if (section.type === "popup_campaign") {
      popup = {
        ...formatHomeSectionForPublic(section),
        ...data,
        frequency:
          section.config?.popupFrequency ||
          data.campaign?.popupFrequency ||
          "session",
      };
      continue;
    }

    if (section.type === "announcement_bar") {
      // Announcement bar is exposed at the top-level `announcement` field.
      continue;
    }

    pageSections.push({
      ...formatHomeSectionForPublic(section),
      data,
    });
  }

  return {
    announcement,
    sections: pageSections,
    popup,
  };
};

export const listHomeSectionsAdmin = async () => {
  await ensureDefaultSections();
  const sections = await HomeSectionRepository.findAllSorted();
  return { sections: sections.map(formatHomeSectionForDashboard) };
};

export const createHomeSection = async (body) => {
  const { key, type } = body;
  if (!key?.trim()) throw createError("Section key is required");
  if (!HOME_SECTION_TYPES.includes(type)) {
    throw createError("Invalid section type");
  }

  const normalizedKey = slugify(key);
  const existing = await HomeSectionRepository.findOne({ key: normalizedKey });
  if (existing) throw createError("A section with this key already exists", 409);

  const section = await HomeSectionRepository.create({
    key: normalizedKey,
    type,
    title: body.title?.trim() || "",
    subtitle: body.subtitle?.trim() || "",
    displayOrder: Number(body.displayOrder) || 0,
    isActive: body.isActive ?? true,
    startsAt: body.startsAt || undefined,
    endsAt: body.endsAt || undefined,
    backgroundColor: body.backgroundColor,
    textColor: body.textColor,
    ctaText: body.ctaText,
    ctaLink: body.ctaLink,
    image: normalizeStoredImage(body.image),
    items: Array.isArray(body.items)
      ? body.items.map((item) => ({
          title: item.title || "",
          subtitle: item.subtitle || "",
          caption: item.caption || "",
          price: item.price || "",
          kicker: item.kicker || "",
          link: item.link || "",
          displayOrder: Number(item.displayOrder) || 0,
          image: normalizeStoredImage(item.image),
        }))
      : [],
    config: body.config || {},
  });

  return { section: formatHomeSectionForDashboard(section), __status: 201 };
};

export const updateHomeSection = async (id, body) => {
  const section = await HomeSectionRepository.findById(id);
  if (!section) throw createError("Home section not found", 404);

  if (body.type !== undefined && !HOME_SECTION_TYPES.includes(body.type)) {
    throw createError("Invalid section type");
  }

  if (body.key !== undefined) {
    const normalizedKey = slugify(body.key);
    const existing = await HomeSectionRepository.findOne({
      key: normalizedKey,
      _id: { $ne: id },
    });
    if (existing) throw createError("A section with this key already exists", 409);
    section.key = normalizedKey;
  }

  const scalarFields = [
    "type",
    "title",
    "subtitle",
    "displayOrder",
    "isActive",
    "startsAt",
    "endsAt",
    "backgroundColor",
    "textColor",
    "ctaText",
    "ctaLink",
  ];

  scalarFields.forEach((field) => {
    if (body[field] !== undefined) section[field] = body[field];
  });

  if (body.image !== undefined) {
    section.image = normalizeStoredImage(body.image);
  }

  if (body.items !== undefined) {
    section.items = Array.isArray(body.items)
      ? body.items.map((item) => ({
          title: item.title || "",
          subtitle: item.subtitle || "",
          caption: item.caption || "",
          price: item.price || "",
          kicker: item.kicker || "",
          link: item.link || "",
          displayOrder: Number(item.displayOrder) || 0,
          image: normalizeStoredImage(item.image),
        }))
      : [];
  }

  if (body.config !== undefined) {
    section.config = { ...(toPlain(section.config) || {}), ...body.config };
  }

  await section.save();
  return { section: formatHomeSectionForDashboard(section) };
};

export const reorderHomeSections = async (body) => {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) throw createError("items array is required");

  const ops = items.map((item, index) => ({
    updateOne: {
      filter: { _id: item.id || item._id },
      update: {
        $set: {
          displayOrder:
            item.displayOrder !== undefined ? item.displayOrder : (index + 1) * 10,
        },
      },
    },
  }));

  await HomeSectionRepository.bulkWrite(ops);
  return listHomeSectionsAdmin();
};

export const toggleHomeSectionStatus = async (id, body) => {
  const section = await HomeSectionRepository.findById(id);
  if (!section) throw createError("Home section not found", 404);

  section.isActive =
    typeof body?.isActive === "boolean" ? body.isActive : !section.isActive;
  await section.save();

  return { section: formatHomeSectionForDashboard(section) };
};

export const deleteHomeSection = async (id) => {
  const section = await HomeSectionRepository.findById(id);
  if (!section) throw createError("Home section not found", 404);

  await section.deleteOne();
  return { message: "Home section deleted" };
};

import Banner from "../models/Banner.model.js";
import Announcement from "../models/Announcement.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const now = () => new Date();

const activeDateFilter = {
  $or: [
    { startsAt: null, endsAt: null },
    { startsAt: { $lte: now() }, endsAt: null },
    { startsAt: null, endsAt: { $gte: now() } },
    { startsAt: { $lte: now() }, endsAt: { $gte: now() } },
  ],
};

export const getBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({
    isActive: true,
    ...activeDateFilter,
  }).sort({ displayOrder: 1 });

  sendSuccess(res, { banners });
});

export const getAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({
    isActive: true,
    ...activeDateFilter,
  }).sort({ priority: -1 });

  sendSuccess(res, { announcements });
});

export const listBannersAdmin = asyncHandler(async (req, res) => {
  const banners = await Banner.find().sort({ displayOrder: 1, createdAt: -1 });
  sendSuccess(res, { banners });
});

export const createBanner = asyncHandler(async (req, res) => {
  const { title, image } = req.body;
  if (!title || !image) return sendError(res, "title and image are required");

  const banner = await Banner.create(req.body);
  sendSuccess(res, { banner }, 201);
});

export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) return sendError(res, "Banner not found", 404);

  const allowed = [
    "title",
    "subtitle",
    "description",
    "image",
    "ctaText",
    "ctaLink",
    "displayOrder",
    "startsAt",
    "endsAt",
    "isActive",
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) banner[field] = req.body[field];
  });

  await banner.save();
  sendSuccess(res, { banner });
});

export const toggleBannerStatus = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) return sendError(res, "Banner not found", 404);

  banner.isActive =
    typeof req.body.isActive === "boolean" ? req.body.isActive : !banner.isActive;
  await banner.save();

  sendSuccess(res, { banner });
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) return sendError(res, "Banner not found", 404);

  banner.isActive = false;
  await banner.save();

  sendSuccess(res, { message: "Banner deactivated" });
});

import Banner from "../models/Banner.model.js";
import Announcement from "../models/Announcement.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

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

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

const publicAnnouncementFilter = {
  isActive: true,
  ...activeDateFilter,
};

export const getAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find(publicAnnouncementFilter).sort({
    priority: -1,
    createdAt: -1,
  });

  sendSuccess(res, { announcements });
});

export const getAnnouncementById = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({
    _id: req.params.id,
    ...publicAnnouncementFilter,
  });

  if (!announcement) {
    return sendError(res, "Announcement not found", 404);
  }

  sendSuccess(res, { announcement });
});

export const listAnnouncementsAdmin = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find().sort({ priority: -1, createdAt: -1 });
  sendSuccess(res, { announcements });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    return sendError(res, "Message is required");
  }

  const announcement = await Announcement.create({
    message: message.trim(),
    isActive: req.body.isActive ?? true,
    priority: req.body.priority ?? 0,
    startsAt: req.body.startsAt,
    endsAt: req.body.endsAt,
    backgroundColor: req.body.backgroundColor?.trim(),
    textColor: req.body.textColor?.trim(),
  });

  sendSuccess(res, { announcement }, 201);
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    return sendError(res, "Announcement not found", 404);
  }

  if (req.body.message !== undefined) {
    const message = req.body.message?.trim();
    if (!message) {
      return sendError(res, "Message is required");
    }
    announcement.message = message;
  }

  const allowed = [
    "isActive",
    "priority",
    "startsAt",
    "endsAt",
    "backgroundColor",
    "textColor",
  ];

  allowed.forEach((field) => {
    if (req.body[field] === undefined) return;

    if (field === "backgroundColor" || field === "textColor") {
      announcement[field] = req.body[field]?.trim() || undefined;
      return;
    }

    announcement[field] = req.body[field];
  });

  await announcement.save();
  sendSuccess(res, { announcement });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    return sendError(res, "Announcement not found", 404);
  }

  await announcement.deleteOne();
  sendSuccess(res, { message: "Announcement deleted" });
});

import Seller from "../models/Seller.model.js";
import User from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { slugify } from "../utils/userHelpers.js";
import {
  assertEmailMobileNotRegisteredAsCustomer,
  CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE,
} from "../utils/authHelpers.js";

export const applyForSeller = asyncHandler(async (req, res) => {
  if (req.user.role === "admin") {
    return sendError(res, "Admin accounts cannot apply as sellers", 400);
  }

  if (req.user.role === "customer") {
    return sendError(res, CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE, 403);
  }

  if (req.user.role !== "seller") {
    return sendError(res, "You are not eligible to apply as a seller", 403);
  }

  const { storeName, name, mobileNumber, description, tinNumber, address, bankDetails, documents, logo, banner } =
    req.body;

  if (!name?.trim()) {
    return sendError(res, "Name is required");
  }

  if (!mobileNumber?.trim()) {
    return sendError(res, "Mobile number is required");
  }

  const normalizedMobile = mobileNumber.trim();

  const mobileTaken = await User.findOne({
    mobileNumber: normalizedMobile,
    _id: { $ne: req.user._id },
  });
  if (mobileTaken) {
    return sendError(res, "This mobile number is already registered", 400);
  }

  await assertEmailMobileNotRegisteredAsCustomer({
    email: req.user.email,
    mobileNumber: normalizedMobile,
    excludeUserId: req.user._id,
  });

  const existing = await Seller.findOne({ user: req.user._id });
  if (existing) {
    if (existing.approvalStatus === "Pending") {
      return sendError(res, "Your seller application is already pending review", 400);
    }
    if (existing.approvalStatus === "Approved") {
      return sendError(res, "You are already an approved seller", 400);
    }
    if (existing.approvalStatus === "Rejected") {
      return sendError(
        res,
        "Your previous application was rejected. Contact support to reapply",
        400
      );
    }
  }

  if (!storeName?.trim()) {
    return sendError(res, "Store name is required");
  }

  req.user.name = name.trim();
  req.user.mobileNumber = normalizedMobile;
  await req.user.save();

  const storeSlug = slugify(storeName);
  const slugTaken = await Seller.findOne({ storeSlug });
  if (slugTaken) {
    return sendError(res, "A store with a similar name already exists");
  }

  const seller = await Seller.create({
    user: req.user._id,
    storeName: storeName.trim(),
    storeSlug,
    description,
    tinNumber,
    address,
    bankDetails,
    documents,
    logo,
    banner,
    approvalStatus: "Pending",
  });

  sendSuccess(res, { seller }, 201);
});

export const getMySellerProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, { seller: req.seller });
});

export const updateMySellerProfile = asyncHandler(async (req, res) => {
  const seller = req.seller;

  if (seller.approvalStatus === "Pending") {
    const pendingFields = [
      "description",
      "tinNumber",
      "address",
      "bankDetails",
      "documents",
      "logo",
      "banner",
    ];

    if (req.body.storeName !== undefined) {
      const storeName = req.body.storeName?.trim();
      if (!storeName) {
        return sendError(res, "Store name is required");
      }

      const storeSlug = slugify(storeName);
      if (storeSlug !== seller.storeSlug) {
        const slugTaken = await Seller.findOne({ storeSlug, _id: { $ne: seller._id } });
        if (slugTaken) {
          return sendError(res, "A store with a similar name already exists");
        }
        seller.storeName = storeName;
        seller.storeSlug = storeSlug;
      }
    }

    pendingFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        seller[field] = req.body[field];
      }
    });
  } else {
    const approvedFields = [
      "logo",
      "banner",
      "description",
      "address",
      "bankDetails",
      "documents",
    ];

    approvedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        seller[field] = req.body[field];
      }
    });
  }

  await seller.save();
  sendSuccess(res, { seller });
});

export const getSellerBySlug = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({
    storeSlug: req.params.slug,
    approvalStatus: "Approved",
    isActive: true,
  })
    .select("-bankDetails -documents -commissionRate")
    .populate("user", "name avatar");

  if (!seller) {
    return sendError(res, "Store not found", 404);
  }

  sendSuccess(res, { seller });
});

export const listSellers = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};

  if (status) {
    filter.approvalStatus = status;
  }

  const sellers = await Seller.find(filter)
    .populate("user", "name email mobileNumber role")
    .sort("-createdAt");

  sendSuccess(res, { sellers });
});

export const approveSeller = asyncHandler(async (req, res) => {
  const seller = await Seller.findById(req.params.id).populate("user");
  if (!seller) {
    return sendError(res, "Seller application not found", 404);
  }

  if (seller.approvalStatus === "Approved") {
    return sendError(res, "Seller is already approved", 400);
  }

  const { commissionRate } = req.body;

  seller.approvalStatus = "Approved";
  seller.isVerified = true;
  seller.rejectionReason = undefined;
  if (commissionRate !== undefined) {
    seller.commissionRate = commissionRate;
  }

  await seller.save();

  await User.findByIdAndUpdate(seller.user._id, { role: "seller" });

  sendSuccess(res, { seller, message: "Seller approved successfully" });
});

export const rejectSeller = asyncHandler(async (req, res) => {
  const seller = await Seller.findById(req.params.id);
  if (!seller) {
    return sendError(res, "Seller application not found", 404);
  }

  if (seller.approvalStatus === "Approved") {
    return sendError(res, "Cannot reject an already approved seller", 400);
  }

  const { reason } = req.body;
  if (!reason?.trim()) {
    return sendError(res, "Rejection reason is required");
  }

  seller.approvalStatus = "Rejected";
  seller.isVerified = false;
  seller.rejectionReason = reason.trim();

  await seller.save();

  sendSuccess(res, { seller, message: "Seller application rejected" });
});

export const deactivateSeller = asyncHandler(async (req, res) => {
  const seller = await Seller.findById(req.params.id).populate("user");
  if (!seller) {
    return sendError(res, "Seller not found", 404);
  }

  seller.isActive = false;
  await seller.save();

  sendSuccess(res, { seller, message: "Seller deactivated" });
});

import * as SellerRepository from "../repositories/seller.repository.js";
import * as UserRepository from "../repositories/user.repository.js";
import { slugify } from "../utils/helpers/userHelpers.js";
import {
  assertEmailMobileNotRegisteredAsCustomer,
  CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE,
} from "../utils/helpers/authHelpers.js";
import {
  formatSellerForDashboard,
  formatSellerForPublic,
  mergeSellerDocuments,
  normalizeStoredImage,
  normalizeSellerDocuments,
} from "../utils/helpers/storedImageHelpers.js";
import { createError } from "../utils/AppError.js";
import * as SellerEmail from "./sellerEmail.service.js";

export const applyForSeller = async (user, body) => {
  if (user.role === "admin") {
    throw createError("Admin accounts cannot apply as sellers", 400);
  }

  if (user.role === "customer") {
    throw createError(CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE, 403);
  }

  if (user.role !== "seller") {
    throw createError("You are not eligible to apply as a seller", 403);
  }

  const {
    storeName,
    name,
    mobileNumber,
    description,
    tinNumber,
    nationalId,
    address,
    bankDetails,
    documents,
    logo,
    banner,
  } = body;

  if (!name?.trim()) throw createError("Name is required");
  if (!mobileNumber?.trim()) throw createError("Mobile number is required");

  const normalizedMobile = mobileNumber.trim();

  const mobileTaken = await UserRepository.findOne({
    mobileNumber: normalizedMobile,
    _id: { $ne: user._id },
  });
  if (mobileTaken) {
    throw createError("This mobile number is already registered", 400);
  }

  await assertEmailMobileNotRegisteredAsCustomer({
    email: user.email,
    mobileNumber: normalizedMobile,
    excludeUserId: user._id,
  });

  const existing = await SellerRepository.findByUser(user._id);
  if (existing) {
    if (existing.approvalStatus === "Pending") {
      throw createError("Your seller application is already pending review", 400);
    }
    if (existing.approvalStatus === "Approved") {
      throw createError("You are already an approved seller", 400);
    }
    if (existing.approvalStatus === "Rejected") {
      throw createError(
        "Your previous application was rejected. Contact support to reapply",
        400
      );
    }
  }

  if (!storeName?.trim()) throw createError("Store name is required");
  if (!nationalId?.trim()) throw createError("National ID is required");

  user.name = name.trim();
  user.mobileNumber = normalizedMobile;
  await user.save();

  const storeSlug = slugify(storeName);
  const slugTaken = await SellerRepository.findOne({ storeSlug });
  if (slugTaken) {
    throw createError("A store with a similar name already exists");
  }

  const seller = await SellerRepository.create({
    user: user._id,
    storeName: storeName.trim(),
    storeSlug,
    description,
    tinNumber,
    address,
    bankDetails,
    nationalId: nationalId.trim(),
    documents: normalizeSellerDocuments(documents),
    logo: normalizeStoredImage(logo),
    banner: normalizeStoredImage(banner),
    approvalStatus: "Pending",
  });

  await SellerEmail.notifySellerApplicationSubmitted(seller, user);

  return { seller: formatSellerForDashboard(seller), __status: 201 };
};

export const getMySellerProfile = async (seller) => ({
  seller: formatSellerForDashboard(seller),
});

export const updateMySellerProfile = async (seller, body) => {
  const wasRejected = seller.approvalStatus === "Rejected";

  if (seller.approvalStatus === "Pending" || seller.approvalStatus === "Rejected") {
    const pendingFields = [
      "description",
      "tinNumber",
      "address",
      "bankDetails",
      "documents",
      "logo",
      "banner",
    ];

    if (body.storeName !== undefined) {
      const storeName = body.storeName?.trim();
      if (!storeName) throw createError("Store name is required");

      const storeSlug = slugify(storeName);
      if (storeSlug !== seller.storeSlug) {
        const slugTaken = await SellerRepository.findOne({
          storeSlug,
          _id: { $ne: seller._id },
        });
        if (slugTaken) {
          throw createError("A store with a similar name already exists");
        }
        seller.storeName = storeName;
        seller.storeSlug = storeSlug;
      }
    }

    if (body.nationalId !== undefined) {
      const nationalId = body.nationalId?.trim();
      if (!nationalId) throw createError("National ID is required");

      if (nationalId !== seller.nationalId) {
        const nationalIdTaken = await SellerRepository.findOne({
          nationalId,
          _id: { $ne: seller._id },
        });
        if (nationalIdTaken) {
          throw createError("This national ID is already registered", 400);
        }
        seller.nationalId = nationalId;
      }
    }

    pendingFields.forEach((field) => {
      if (body[field] === undefined) return;

      if (field === "logo" || field === "banner") {
        seller[field] = normalizeStoredImage(body[field]);
        return;
      }

      if (field === "documents") {
        seller.documents = mergeSellerDocuments(seller.documents, body.documents);
        return;
      }

      seller[field] = body[field];
    });

    if (wasRejected) {
      seller.approvalStatus = "Pending";
      seller.rejectionReason = undefined;
    }
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
      if (body[field] === undefined) return;

      if (field === "logo" || field === "banner") {
        seller[field] = normalizeStoredImage(body[field]);
        return;
      }

      if (field === "documents") {
        seller.documents = mergeSellerDocuments(seller.documents, body.documents);
        return;
      }

      seller[field] = body[field];
    });
  }

  await seller.save();

  if (wasRejected && seller.approvalStatus === "Pending") {
    const sellerWithUser = await SellerRepository.findById(seller._id).populate(
      "user",
      "name email mobileNumber"
    );
    await SellerEmail.notifySellerApplicationSubmitted(
      sellerWithUser,
      sellerWithUser?.user
    );
  }

  return { seller: formatSellerForDashboard(seller) };
};

export const getSellerBySlug = async (slug) => {
  const seller = await SellerRepository.findOne({
    storeSlug: slug,
    approvalStatus: "Approved",
    isActive: true,
  })
    .select("-bankDetails -documents -commissionRate")
    .populate("user", "name avatar");

  if (!seller) throw createError("Store not found", 404);

  return { seller: formatSellerForPublic(seller) };
};

export const listSellers = async (status, query = {}) => {
  const filter = {};
  if (status) filter.approvalStatus = status;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const total = await SellerRepository.countDocuments(filter);

  let queryBuilder = SellerRepository.find(filter)
    .populate("user", "name email mobileNumber role")
    .sort("-createdAt");

  if (query.page || query.limit) {
    queryBuilder = queryBuilder.skip(skip).limit(limit);
  }

  const sellers = await queryBuilder;

  return {
    sellers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const approveSeller = async (sellerId, { commissionRate }) => {
  const seller = await SellerRepository.findById(sellerId).populate("user");
  if (!seller) throw createError("Seller application not found", 404);

  if (seller.approvalStatus === "Approved") {
    throw createError("Seller is already approved", 400);
  }

  seller.approvalStatus = "Approved";
  seller.isVerified = true;
  seller.isActive = true;
  seller.rejectionReason = undefined;
  if (commissionRate !== undefined) {
    seller.commissionRate = commissionRate;
  }

  await seller.save();
  await UserRepository.findByIdAndUpdate(seller.user._id, { role: "seller" });

  await SellerEmail.notifySellerApproved(seller);

  return { seller, message: "Seller approved successfully" };
};

export const rejectSeller = async (sellerId, { reason }) => {
  const seller = await SellerRepository.findById(sellerId).populate("user");
  if (!seller) throw createError("Seller application not found", 404);

  if (seller.approvalStatus === "Approved") {
    throw createError("Cannot reject an already approved seller", 400);
  }

  if (!reason?.trim()) throw createError("Rejection reason is required");

  seller.approvalStatus = "Rejected";
  seller.isVerified = false;
  seller.rejectionReason = reason.trim();

  await seller.save();

  await SellerEmail.notifySellerRejected(seller);

  return { seller, message: "Seller application rejected" };
};

export const deactivateSeller = async (sellerId, { reason } = {}) => {
  const seller = await SellerRepository.findById(sellerId).populate("user");
  if (!seller) throw createError("Seller not found", 404);

  if (seller.isActive === false) {
    throw createError("Seller is already deactivated", 400);
  }

  seller.isActive = false;
  await seller.save();

  await SellerEmail.notifySellerDeactivated(seller, { reason });

  return { seller, message: "Seller deactivated" };
};

export const reactivateSeller = async (sellerId) => {
  const seller = await SellerRepository.findById(sellerId).populate("user");
  if (!seller) throw createError("Seller not found", 404);

  if (seller.approvalStatus !== "Approved") {
    throw createError("Only approved sellers can be reactivated", 400);
  }

  if (seller.isActive === true) {
    throw createError("Seller is already active", 400);
  }

  seller.isActive = true;
  await seller.save();

  await SellerEmail.notifySellerReactivated(seller);

  return { seller, message: "Seller reactivated" };
};

export const getSellerById = async (sellerId) => {
  const seller = await SellerRepository.findById(sellerId).populate(
    "user",
    "name email mobileNumber role isActive"
  );

  if (!seller) throw createError("Seller not found", 404);

  return { seller: formatSellerForDashboard(seller) };
};

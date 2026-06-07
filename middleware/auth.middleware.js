import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Seller from "../models/Seller.model.js";
import { sendError } from "../utils/apiResponse.js";

export const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return sendError(res, "Not authenticated", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-__v");

    if (!user) {
      return sendError(res, "User not found", 401);
    }

    if (!user.isActive) {
      return sendError(res, "Account is deactivated", 403);
    }

    req.user = user;
    next();
  } catch {
    return sendError(res, "Invalid or expired token", 401);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      req.user = user?.isActive ? user : null;
    }
  } catch {
    req.user = null;
  }
  next();
};

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, "You do not have permission to perform this action", 403);
    }
    next();
  };

export const requireSellerProfile = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }

  const seller = await Seller.findOne({ user: req.user._id });

  if (!seller) {
    return sendError(res, "No seller profile found. Apply to become a seller first", 404);
  }

  if (seller.approvalStatus === "Rejected") {
    return sendError(res, "Your application was rejected. Contact support to reapply", 403);
  }

  req.seller = seller;
  next();
};

export const requireApprovedSeller = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }

  if (req.user.role !== "seller") {
    return sendError(res, "Seller account required", 403);
  }

  const seller = await Seller.findOne({
    user: req.user._id,
    approvalStatus: "Approved",
    isActive: true,
  });

  if (!seller) {
    return sendError(res, "Approved seller profile required", 403);
  }

  req.seller = seller;
  next();
};

export const attachSellerProfile = async (req, res, next) => {
  if (req.user.role === "seller" || req.user.role === "customer") {
    req.seller = await Seller.findOne({ user: req.user._id });
  }
  next();
};

import jwt from "jsonwebtoken";
import { initFirebaseAdmin } from "../vendor/firebase.vendor.js";
import User from "../models/User.model.js";
import Cart from "../models/Cart.model.js";
import Wishlist from "../models/Wishlist.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const issueToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const ensureUserSideCollections = async (userId) => {
  await Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { items: [] } },
    { upsert: true }
  );
  await Wishlist.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { products: [] } },
    { upsert: true }
  );
};

export const login = asyncHandler(async (req, res) => {
  console.log("login");
  const { token } = req.body;
  if (!token) return sendError(res, "Firebase token is required");

  const admin = initFirebaseAdmin();
  if (!admin.apps?.length) {
    return sendError(res, "Firebase Admin is not configured on server", 503);
  }

  const decoded = await admin.auth().verifyIdToken(token);

  let user = await User.findOne({ firebaseUid: decoded.uid });

  if (!user && decoded.email) {
    user = await User.findOne({ email: decoded.email });
    if (user) {
      user.firebaseUid = decoded.uid;
      await user.save();
    }
  }

  if (!user) {
    user = await User.create({
      firebaseUid: decoded.uid,
      email: decoded.email || undefined,
      name: decoded.name || decoded.email?.split("@")[0],
    });
  }

  await ensureUserSideCollections(user._id);

  const jwtToken = issueToken(user._id);
  setAuthCookie(res, jwtToken);

  sendSuccess(res, {
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      gender: user.gender,
      categoryPreferences: user.categoryPreferences,
    },
    token: jwtToken,
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: req.user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = [
    "name",
    "mobileNumber",
    "birthday",
    "gender",
    "categoryPreferences",
    "avatar",
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      req.user[field] = req.body[field];
    }
  });

  await req.user.save();
  sendSuccess(res, { user: req.user });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  sendSuccess(res, { message: "Logged out" });
});

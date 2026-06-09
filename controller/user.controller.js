import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Cart from "../models/Cart.model.js";
import Wishlist from "../models/Wishlist.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { formatUserProfile } from "../utils/userHelpers.js";
import {
  verifyFirebaseToken,
  loadSellerProfile,
  resolveUserFromFirebase,
  assertCanAccessSellerAuth,
  assertEmailMobileNotRegisteredAsCustomer,
  CUSTOMER_ACCOUNT_MESSAGE,
} from "../utils/authHelpers.js";

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

const sendAuthSuccess = async (res, user) => {
  if (!user.isActive) {
    return sendError(res, "Account is deactivated", 403);
  }

  await ensureUserSideCollections(user._id);

  const seller = await loadSellerProfile(user._id);
  const jwtToken = issueToken(user._id);
  setAuthCookie(res, jwtToken);

  sendSuccess(res, {
    user: formatUserProfile(user, seller),
    token: jwtToken,
  });
};

const handleAuthError = (res, err) => {
  if (err.statusCode) {
    return sendError(res, err.message, err.statusCode);
  }
  throw err;
};

/** Storefront customer login — creates customer account if new */
export const login = asyncHandler(async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req.body.token);

    let user = await resolveUserFromFirebase(decoded);

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email?.toLowerCase() || undefined,
        name: decoded.name || decoded.email?.split("@")[0],
        role: "customer",
      });
    }

    await sendAuthSuccess(res, user);
  } catch (err) {
    handleAuthError(res, err);
  }
});

/** Dashboard seller login — email/password or Google; name & mobile set during store application */
export const loginSeller = asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = await verifyFirebaseToken(token);

    if (!decoded.email) {
      return sendError(
        res,
        "A verified email address is required to sign in as a seller. Use email/password or Google sign-in.",
        400
      );
    }

    let user = await resolveUserFromFirebase(decoded);

    if (user) {
      user = await assertCanAccessSellerAuth(user);
    } else {
      await assertEmailMobileNotRegisteredAsCustomer({
        email: decoded.email,
      });

      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email.toLowerCase(),
        role: "seller",
      });
    }

    await sendAuthSuccess(res, user);
  } catch (err) {
    handleAuthError(res, err);
  }
});

/** Dashboard admin login — admin role only */
export const loginAdmin = asyncHandler(async (req, res) => {
  try {
    const { token, mobileNumber } = req.body;
    const decoded = await verifyFirebaseToken(token);

    const user = await resolveUserFromFirebase(decoded, mobileNumber);

    if (!user) {
      return sendError(
        res,
        "No admin account found for this email or mobile number. Contact the platform owner.",
        404
      );
    }

    if (user.role === "customer") {
      return sendError(res, CUSTOMER_ACCOUNT_MESSAGE, 403);
    }

    if (user.role === "seller") {
      return sendError(
        res,
        "This account is registered as a seller. Please use seller login.",
        403
      );
    }

    if (user.role !== "admin") {
      return sendError(res, "You do not have permission to access the admin panel.", 403);
    }

    await sendAuthSuccess(res, user);
  } catch (err) {
    handleAuthError(res, err);
  }
});

export const getProfile = asyncHandler(async (req, res) => {
  const seller = await loadSellerProfile(req.user._id);
  sendSuccess(res, { user: formatUserProfile(req.user, seller) });
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
  const seller = await loadSellerProfile(req.user._id);
  sendSuccess(res, { user: formatUserProfile(req.user, seller) });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  sendSuccess(res, { message: "Logged out" });
});

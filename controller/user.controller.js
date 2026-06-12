import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Cart from "../models/Cart.model.js";
import Wishlist from "../models/Wishlist.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { formatUserProfile } from "../utils/userHelpers.js";
import { normalizeStoredImage } from "../utils/storedImageHelpers.js";
import {
  verifyFirebaseToken,
  loadSellerProfile,
  resolveUserFromFirebase,
  assertCanAccessSellerAuth,
  assertEmailMobileNotRegisteredAsCustomer,
  CUSTOMER_ACCOUNT_MESSAGE,
} from "../utils/authHelpers.js";
import { assertValidEmail } from "../utils/emailValidation.js";
import { isGoogleSignIn, saveEmailOtp } from "../utils/otpHelpers.js";
import { sendSellerVerificationOtp } from "../service/email.service.js";
import { appConfig } from "../config/appConfig.js";

const OTP_SENT_MESSAGE =
  "An OTP has been sent to your email, please verify.";

const issueToken = (userId) =>
  jwt.sign({ userId }, appConfig.jwt.secret, { expiresIn: "7d" });

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: appConfig.isProduction,
    sameSite: appConfig.isProduction ? "strict" : "lax",
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

/** Dashboard seller login — blocked until email OTP verified (Google exempt) */
export const loginSeller = asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = await verifyFirebaseToken(token);
    if (!decoded.email) {
      return sendError(
        res,
        "A verified email address is required to sign in as a seller.",
        400
      );
    }
    const normalizedEmail = assertValidEmail(decoded.email);
    let user = await resolveUserFromFirebase(decoded);
    const googleSignIn = isGoogleSignIn(decoded);
    if (!user) {
      if (!googleSignIn) {
        return sendError(res, "No account found. Please register first.", 404);
      }
      await assertEmailMobileNotRegisteredAsCustomer({ email: normalizedEmail });
      user = await User.create({
        firebaseUid: decoded.uid,
        email: normalizedEmail,
        role: "seller",
        isVerified: true,
      });
    } else {
      user = await assertCanAccessSellerAuth(user);
    }

    if (!user.isVerified && !googleSignIn) {
      const otp = await saveEmailOtp(normalizedEmail);
      await sendSellerVerificationOtp(normalizedEmail, otp);

      return sendError(
        res,
        `Please verify your email before signing in. ${OTP_SENT_MESSAGE}`,
        403
      );
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
      req.user[field] =
        field === "avatar" ? normalizeStoredImage(req.body[field]) : req.body[field];
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

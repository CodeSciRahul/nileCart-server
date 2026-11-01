import jwt from "jsonwebtoken";
import { appConfig } from "../config/index.js";
import * as UserRepository from "../repositories/user.repository.js";
import * as CartRepository from "../repositories/cart.repository.js";
import * as WishlistRepository from "../repositories/wishlist.repository.js";
import { formatUserProfile } from "../utils/helpers/userHelpers.js";
import { normalizeStoredImage } from "../utils/helpers/storedImageHelpers.js";
import {
  loadSellerProfile,
  resolveUserFromAuthClaims,
  resolveAuthClaims,
  assertCanAccessSellerAuth,
  assertEmailMobileNotRegisteredAsCustomer,
  linkAuthUid,
  generateAuthUid,
  isOAuthSignIn,
  AUTH_PROVIDERS,
  CUSTOMER_ACCOUNT_MESSAGE,
} from "../utils/helpers/authHelpers.js";
import { assertValidEmail } from "../utils/helpers/emailValidation.js";
import {
  hashPassword,
  assertValidPassword,
  verifyUserPassword,
} from "../utils/helpers/passwordHelpers.js";
import {
  saveEmailOtp,
  verifyEmailOtp,
  OTP_PURPOSES,
  getOtpExpirySeconds,
} from "../utils/helpers/otpHelpers.js";
import {
  sendSellerVerificationOtp,
  sendCustomerLoginOtp,
  sendDashboardLoginOtp,
  sendPasswordResetOtp,
} from "../services/email.service.js";
import { issueAuthToken } from "../utils/helpers/authCookieHelpers.js";
import { createError } from "../utils/AppError.js";
import { messages, regex } from "../constants/index.js";

const OTP_SENT_MESSAGE = messages.OTP_SENT;

const ensureUserSideCollections = async (userId) => {
  await CartRepository.ensureForUser(userId);
  await WishlistRepository.ensureForUser(userId);
};

const buildAuthPayload = async (user) => {
  if (!user.isActive) {
    throw createError("Account is deactivated", 403);
  }

  await ensureUserSideCollections(user._id);
  const seller = await loadSellerProfile(user._id);
  const token = issueAuthToken(user._id);

  return {
    user: formatUserProfile(user, seller),
    token,
  };
};

const sendOtpToSeller = async (email) => {
  const otp = await saveEmailOtp(email, OTP_PURPOSES.SELLER_SIGNUP);
  await sendSellerVerificationOtp(email, otp);
};

const sendOtpToDashboard = async (email, purpose) => {
  const otp = await saveEmailOtp(email, purpose);
  await sendDashboardLoginOtp(email, otp);
};

const assertCustomerAuthEligible = (user) => {
  if (!user) return;

  if (user.role === "seller") {
    throw createError(
      "This email is registered as a seller account. Please use the seller dashboard to sign in.",
      403
    );
  }

  if (user.role === "admin") {
    throw createError(
      "This email is registered as an admin account. Please use the admin dashboard to sign in.",
      403
    );
  }
};

const createCustomerUser = async (normalizedEmail) => {
  try {
    return await UserRepository.create({
      firebaseUid: generateAuthUid(),
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0],
      role: "customer",
      authProvider: AUTH_PROVIDERS.PASSWORD,
    });
  } catch (err) {
    if (err.code === 11000) {
      const existingUser = await UserRepository.findByEmail(normalizedEmail);
      if (existingUser) return existingUser;
    }
    throw err;
  }
};

const createSellerUser = async ({
  normalizedEmail,
  password,
  authProvider = AUTH_PROVIDERS.PASSWORD,
  isVerified = false,
}) => {
  const userData = {
    firebaseUid: generateAuthUid(),
    email: normalizedEmail,
    role: "seller",
    isVerified,
    authProvider,
  };

  if (password) {
    assertValidPassword(password);
    userData.passwordHash = await hashPassword(password);
  }

  return UserRepository.create(userData);
};

/**
 * Check whether an account exists and whether it has a password configured.
 * Also performs role authorization checks if role is supplied.
 */
export const lookupAuthMethods = async ({ email, role }) => {
  if (!email) throw createError("Email is required", 400);
  console.log("look hit")

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const user = await UserRepository.findByEmailWithPassword(normalizedEmail);

  if (!user) {
    if (role === "admin") {
      throw createError("No admin account found for this email.", 404);
    }

    return {
      exists: false,
      hasPassword: false,
      role: null,
      isVerified: false,
      email: normalizedEmail,
    };
  }

  if (role) {
    const targetRole = String(role).toLowerCase();
    if (targetRole === "admin" && user.role !== "admin") {
      throw createError("This account is not an admin account.", 403);
    }

    if (targetRole === "seller") {
      if (user.role === "admin") {
        throw createError("This account is an admin account. Please use admin login.", 403);
      }
      if (user.role === "customer") {
        const sellerProfile = await loadSellerProfile(user._id);
        if (!sellerProfile) {
          throw createError(CUSTOMER_ACCOUNT_MESSAGE, 403);
        }
      }
    }

    if (targetRole === "customer") {
      if (user.role === "admin") {
        throw createError(
          "This email is registered as an admin account. Please use the admin dashboard to sign in.",
          403
        );
      }
      if (user.role === "seller") {
        throw createError(
          "This email is registered as a seller account. Please use the seller dashboard to sign in.",
          403
        );
      }
    }
  }

  const hasPassword = Boolean(user.hasPassword || user.passwordHash);

  return {
    exists: true,
    hasPassword,
    role: user.role,
    isVerified: Boolean(user.isVerified),
    email: user.email,
  };
};

/** Customer storefront — send email OTP for unified login/signup */
export const sendCustomerOtp = async ({ email }) => {
  if (!email) throw createError("Email is required", 400);

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const existingUser = await UserRepository.findByEmail(normalizedEmail);
  assertCustomerAuthEligible(existingUser);

  const otp = await saveEmailOtp(normalizedEmail, OTP_PURPOSES.CUSTOMER_LOGIN);
  await sendCustomerLoginOtp(normalizedEmail, otp);

  return {
    success: true,
    message: OTP_SENT_MESSAGE,
    email: normalizedEmail,
    expiresIn: getOtpExpirySeconds(),
  };
};

/** Customer storefront — verify OTP, create user if new, issue JWT */
export const verifyCustomerOtp = async ({ email, otp }) => {
  if (!email || !otp) {
    throw createError("Email and verification code are required", 400);
  }

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const code = String(otp).trim();
  if (!regex.OTP_SIX_DIGIT.test(code)) {
    throw createError("Verification code must be a 6-digit number", 400);
  }

  await verifyEmailOtp(normalizedEmail, code, OTP_PURPOSES.CUSTOMER_LOGIN);

  let user = await UserRepository.findByEmail(normalizedEmail);
  assertCustomerAuthEligible(user);

  let isNewUser = false;

  if (!user) {
    user = await createCustomerUser(normalizedEmail);
    isNewUser = true;
  } else if (!user.firebaseUid) {
    await linkAuthUid(user, generateAuthUid());
  }

  const payload = await buildAuthPayload(user);
  return { ...payload, isNewUser, success: true };
};

/** Dashboard seller/admin — send email OTP for passwordless login */
export const sendDashboardOtp = async ({ email, loginType }) => {
  if (!email) throw createError("Email is required", 400);

  const normalizedEmail = assertValidEmail(email);
  const type = (loginType || "seller").toLowerCase();
  const purpose =
    type === "admin" ? OTP_PURPOSES.ADMIN_LOGIN : OTP_PURPOSES.SELLER_LOGIN;

  const user = await UserRepository.findByEmail(normalizedEmail);

  if (type === "admin") {
    // Admin: only seeded/existing admin accounts can receive OTP.
    if (!user) {
      throw createError("No admin account found for this email.", 404);
    }
    if (user.role !== "admin") {
      throw createError("This account is not an admin account.", 403);
    }
  } else {
    // Seller: allow new emails (auto-register on verification), but block other roles.
    if (user) {
      await assertCanAccessSellerAuth(user);
    } else {
      await assertEmailMobileNotRegisteredAsCustomer({ email: normalizedEmail });
    }
  }

  await sendOtpToDashboard(normalizedEmail, purpose);

  return {
    success: true,
    message: OTP_SENT_MESSAGE,
    email: normalizedEmail,
    expiresIn: getOtpExpirySeconds(),
  };
};

/** Dashboard seller/admin — verify OTP and issue JWT */
export const verifyDashboardOtp = async ({ email, otp, loginType }) => {
  if (!email || !otp) {
    throw createError("Email and verification code are required", 400);
  }

  const normalizedEmail = assertValidEmail(email);
  const type = (loginType || "seller").toLowerCase();
  const purpose =
    type === "admin" ? OTP_PURPOSES.ADMIN_LOGIN : OTP_PURPOSES.SELLER_LOGIN;

  const code = String(otp).trim();
  if (!regex.OTP_SIX_DIGIT.test(code)) {
    throw createError("Verification code must be a 6-digit number", 400);
  }

  await verifyEmailOtp(normalizedEmail, code, purpose);

  let user = await UserRepository.findByEmail(normalizedEmail);

  if (type === "admin") {
    if (!user) {
      throw createError("No admin account found for this email.", 404);
    }
    if (user.role !== "admin") {
      throw createError("This account is not an admin account.", 403);
    }
  } else {
    if (!user) {
      // Auto-register seller on first successful OTP verification.
      user = await createSellerUser({
        normalizedEmail,
        authProvider: AUTH_PROVIDERS.PASSWORD,
        isVerified: true,
      });
    } else {
      user = await assertCanAccessSellerAuth(user);
    }
  }

  const payload = await buildAuthPayload(user);
  return { ...payload, success: true };
};

/** Storefront customer login — creates customer account if new */
export const login = async ({ token, email, password }) => {
  const claims = await resolveAuthClaims({ token, email, password });
  let user = await resolveUserFromAuthClaims(claims);

  if (!user) {
    if (!claims.email) {
      throw createError("A verified email address is required.", 400);
    }

    user = await createCustomerUser(assertValidEmail(claims.email));
  } else {
    assertCustomerAuthEligible(user);
  }

  return buildAuthPayload(user);
};

/** Dashboard seller login — blocked until email OTP verified (OAuth exempt) */
export const loginSeller = async ({ token, email, password }) => {
  const claims = await resolveAuthClaims({ token, email, password });

  if (!claims.email) {
    throw createError(
      "A verified email address is required to sign in as a seller.",
      400
    );
  }

  const normalizedEmail = assertValidEmail(claims.email);
  let user = await resolveUserFromAuthClaims(claims);
  const oauthSignIn = isOAuthSignIn(claims);

  if (!user) {
    if (!oauthSignIn) {
      throw createError("No account found. Please register first.", 404);
    }

    await assertEmailMobileNotRegisteredAsCustomer({ email: normalizedEmail });
    user = await createSellerUser({
      normalizedEmail,
      authProvider: claims.sign_in_provider,
      isVerified: true,
    });
  } else {
    user = await assertCanAccessSellerAuth(user);

    if (password && !claims._user) {
      const userWithPassword = await UserRepository.findByEmailWithPassword(normalizedEmail);
      if (userWithPassword) {
        await verifyUserPassword(userWithPassword, password);
      }
    }
  }

  if (!user?.isVerified && !oauthSignIn) {
    const otp = await saveEmailOtp(normalizedEmail, OTP_PURPOSES.SELLER_SIGNUP);
    await sendSellerVerificationOtp(normalizedEmail, otp);
    throw createError(
      `Please verify your email before signing in. ${OTP_SENT_MESSAGE}`,
      403
    );
  }

  return buildAuthPayload(user);
};

/** Dashboard admin login — admin role only */
export const loginAdmin = async ({ token, email, password, mobileNumber }) => {
  const claims = await resolveAuthClaims({ token, email, password });
  const user = await resolveUserFromAuthClaims(claims, mobileNumber);

  if (!user) {
    throw createError(
      "No admin account found for this email or mobile number. Contact the platform owner.",
      404
    );
  }

  if (password && !claims._user) {
    const userWithPassword = await UserRepository.findByEmailWithPassword(user.email);
    if (userWithPassword) {
      await verifyUserPassword(userWithPassword, password);
    }
  }

  if (user.role === "customer") {
    throw createError(CUSTOMER_ACCOUNT_MESSAGE, 403);
  }

  if (user.role === "seller") {
    throw createError(
      "This account is registered as a seller. Please use seller login.",
      403
    );
  }

  if (user.role !== "admin") {
    throw createError("You do not have permission to access the admin panel.", 403);
  }

  return buildAuthPayload(user);
};

export const getProfile = async (user) => {
  const seller = await loadSellerProfile(user._id);
  return { user: formatUserProfile(user, seller) };
};

export const updateProfile = async (user, body) => {
  const allowed = [
    "name",
    "mobileNumber",
    "birthday",
    "gender",
    "categoryPreferences",
    "avatar",
  ];

  allowed.forEach((field) => {
    if (body[field] !== undefined) {
      user[field] =
        field === "avatar" ? normalizeStoredImage(body[field]) : body[field];
    }
  });

  await user.save();
  const seller = await loadSellerProfile(user._id);
  return { user: formatUserProfile(user, seller) };
};

export const logout = async () => ({ message: "Logged out", clearCookie: true });

export const deleteAccount = async (user) => {
  if (user.role !== "customer") {
    throw createError(
      "This account cannot be deleted from the storefront. Contact support.",
      403
    );
  }

  const userId = user._id;

  user.isActive = false;
  user.firebaseUid = `deleted_${userId}`;
  if (user.email) {
    user.email = `deleted_${userId}@deleted.nilecart.local`;
  }
  user.mobileNumber = undefined;
  user.name = "Deleted User";
  user.passwordHash = undefined;

  await user.save();

  return { message: "Account deleted successfully", clearCookie: true };
};

/**
 * Set initial password for users who registered via OTP and do not yet have a password.
 */
export const setPassword = async (user, { password, confirmPassword }) => {
  if (!password) {
    throw createError("Password is required.", 400);
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw createError("Passwords do not match.", 400);
  }

  assertValidPassword(password);

  const userWithPassword = await UserRepository.findByIdWithPassword(user._id);
  if (!userWithPassword) {
    throw createError("User not found.", 404);
  }

  if (userWithPassword.passwordHash) {
    throw createError(
      "A password has already been set for this account. Please use Change Password.",
      400
    );
  }

  const passwordHash = await hashPassword(password);
  userWithPassword.passwordHash = passwordHash;
  userWithPassword.hasPassword = true;
  userWithPassword.authProvider = userWithPassword.authProvider || AUTH_PROVIDERS.PASSWORD;
  await userWithPassword.save();

  return {
    success: true,
    message: "Password set successfully.",
    hasPassword: true,
  };
};

/**
 * Securely change password for authenticated users who already have a password configured.
 * If user hasn't set one yet, allows setting new password directly.
 */
export const changePassword = async (
  user,
  { currentPassword, newPassword, confirmPassword }
) => {
  if (!newPassword) {
    throw createError("New password is required.", 400);
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw createError("Passwords do not match.", 400);
  }

  assertValidPassword(newPassword);

  const userWithPassword = await UserRepository.findByIdWithPassword(user._id);
  if (!userWithPassword) {
    throw createError("User not found.", 404);
  }

  // If no password was previously configured, allow setting it without currentPassword
  if (!userWithPassword.passwordHash) {
    const passwordHash = await hashPassword(newPassword);
    userWithPassword.passwordHash = passwordHash;
    userWithPassword.hasPassword = true;
    userWithPassword.authProvider = userWithPassword.authProvider || AUTH_PROVIDERS.PASSWORD;
    await userWithPassword.save();

    return {
      success: true,
      message: "Password set successfully.",
      hasPassword: true,
    };
  }

  if (!currentPassword) {
    throw createError("Current password is required.", 400);
  }

  await verifyUserPassword(userWithPassword, currentPassword);

  if (currentPassword === newPassword) {
    throw createError("New password must be different from current password.", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  userWithPassword.passwordHash = passwordHash;
  userWithPassword.hasPassword = true;
  await userWithPassword.save();

  return {
    success: true,
    message: "Password changed successfully.",
    hasPassword: true,
  };
};

/**
 * Send OTP for forgot password verification.
 */
export const sendForgotPasswordOtp = async ({ email, role }) => {
  if (!email) throw createError("Email is required.", 400);

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const user = await UserRepository.findByEmail(normalizedEmail);

  if (!user) {
    throw createError("No account found with this email address.", 404);
  }

  if (role) {
    const targetRole = String(role).toLowerCase();
    if (targetRole === "admin" && user.role !== "admin") {
      throw createError("This account is not an admin account.", 403);
    }
    if (targetRole === "seller" && user.role !== "seller") {
      throw createError("This account is not a seller account.", 403);
    }
  }

  const otp = await saveEmailOtp(normalizedEmail, OTP_PURPOSES.PASSWORD_RESET);
  await sendPasswordResetOtp(normalizedEmail, otp);

  return {
    success: true,
    message: OTP_SENT_MESSAGE,
    email: normalizedEmail,
    expiresIn: getOtpExpirySeconds(),
  };
};

/**
 * Verify OTP for forgot password and issue short-lived password reset token.
 */
export const verifyForgotPasswordOtp = async ({ email, otp }) => {
  if (!email || !otp) {
    throw createError("Email and verification code are required.", 400);
  }

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const code = String(otp).trim();
  if (!regex.OTP_SIX_DIGIT.test(code)) {
    throw createError("Verification code must be a 6-digit number.", 400);
  }

  await verifyEmailOtp(normalizedEmail, code, OTP_PURPOSES.PASSWORD_RESET);

  const user = await UserRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError("User not found.", 404);
  }

  const resetToken = jwt.sign(
    {
      type: "password_reset",
      userId: String(user._id),
      email: normalizedEmail,
    },
    appConfig.jwt.secret,
    { expiresIn: "15m" }
  );

  return {
    success: true,
    resetToken,
    message: "Verification code accepted. Please set your new password.",
  };
};

/**
 * Reset password using verified resetToken or directly with valid OTP.
 */
export const resetPassword = async ({
  resetToken,
  email,
  otp,
  newPassword,
  confirmPassword,
}) => {
  if (!newPassword) {
    throw createError("New password is required.", 400);
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw createError("Passwords do not match.", 400);
  }

  assertValidPassword(newPassword);

  let userId;
  let targetEmail;

  if (resetToken) {
    try {
      const decoded = jwt.verify(resetToken, appConfig.jwt.secret);
      if (decoded.type !== "password_reset") {
        throw createError("Invalid password reset token.", 400);
      }
      userId = decoded.userId;
      targetEmail = decoded.email;
    } catch {
      throw createError(
        "Password reset session has expired. Please request a new verification code.",
        401
      );
    }
  } else if (email && otp) {
    const normalizedEmail = assertValidEmail(email);
    const code = String(otp).trim();
    if (!regex.OTP_SIX_DIGIT.test(code)) {
      throw createError("Verification code must be a 6-digit number.", 400);
    }
    await verifyEmailOtp(normalizedEmail, code, OTP_PURPOSES.PASSWORD_RESET);
    targetEmail = normalizedEmail;
  } else {
    throw createError("Reset token or verification code is required.", 400);
  }

  const user = userId
    ? await UserRepository.findByIdWithPassword(userId)
    : await UserRepository.findByEmailWithPassword(targetEmail);

  if (!user) {
    throw createError("User not found.", 404);
  }

  const passwordHash = await hashPassword(newPassword);
  user.passwordHash = passwordHash;
  user.hasPassword = true;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return {
    success: true,
    message: "Password reset successfully. You can now sign in with your new password.",
  };
};

export const sendSellerSignupOtp = async ({ email }) => {
  if (!email) throw createError("Email is required");

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const user = await UserRepository.findOne({ email: normalizedEmail, role: "seller" });

  if (!user) {
    throw createError("No seller account found. Please register first.", 404);
  }

  if (user.isVerified) {
    throw createError("Email is already verified. Please sign in.", 400);
  }

  await sendOtpToSeller(normalizedEmail);

  return {
    message: OTP_SENT_MESSAGE,
    email: normalizedEmail,
  };
};

export const verifySellerSignupOtp = async ({ email, otp }) => {
  if (!email || !otp) {
    throw createError("Email and verification code are required");
  }

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    throw createError(err.message, err.statusCode || 400);
  }

  const code = String(otp).trim();
  if (!regex.OTP_SIX_DIGIT.test(code)) {
    throw createError("Verification code must be a 6-digit number");
  }

  const user = await UserRepository.findOne({ email: normalizedEmail, role: "seller" });
  if (!user) {
    throw createError("No seller account found. Please register first.", 404);
  }

  if (user.isVerified) {
    return {
      message: "Email is already verified. You can sign in.",
      isVerified: true,
    };
  }

  await verifyEmailOtp(normalizedEmail, code, OTP_PURPOSES.SELLER_SIGNUP);

  user.isVerified = true;
  await user.save();

  return {
    message: "Email verified successfully. You can now sign in.",
    isVerified: true,
  };
};

export const registerSellerAccount = async ({
  token,
  email,
  password,
  signInProvider,
}) => {
  let claims;

  if (email && password) {
    let normalizedEmail;
    try {
      normalizedEmail = assertValidEmail(email);
    } catch (err) {
      throw createError(err.message, err.statusCode || 400);
    }

    assertValidPassword(password);

    claims = {
      uid: generateAuthUid(),
      email: normalizedEmail,
      sign_in_provider: signInProvider || AUTH_PROVIDERS.PASSWORD,
      _password: password,
    };
  } else {
    if (!token) throw createError("Authentication token is required", 400);

    try {
      claims = await resolveAuthClaims({ token });
    } catch (err) {
      throw createError(err.message, err.statusCode || 401);
    }
  }

  if (!claims.email) {
    throw createError(
      "A verified email address is required to register as a seller.",
      400
    );
  }

  const normalizedEmail = assertValidEmail(claims.email);
  let user = await resolveUserFromAuthClaims(claims);

  if (user) {
    if (user.role === "customer") {
      throw createError(CUSTOMER_ACCOUNT_MESSAGE, 403);
    }

    if (user.role === "seller") {
      if (user.isVerified) {
        throw createError(
          "An account with this email already exists. Please sign in.",
          400
        );
      }

      await linkAuthUid(user, claims.uid);
      await sendOtpToSeller(normalizedEmail);

      return {
        message: OTP_SENT_MESSAGE,
        requiresVerification: true,
        email: normalizedEmail,
      };
    }

    throw createError("You are not eligible to register as a seller.", 403);
  }

  await assertEmailMobileNotRegisteredAsCustomer({ email: normalizedEmail });

  const oauthSignIn = isOAuthSignIn(claims);

  user = await createSellerUser({
    normalizedEmail,
    password: claims._password,
    authProvider: claims.sign_in_provider,
    isVerified: oauthSignIn,
  });

  if (oauthSignIn) {
    return {
      message: "Account created successfully.",
      requiresVerification: false,
      isVerified: true,
      email: normalizedEmail,
    };
  }

  await sendOtpToSeller(normalizedEmail);

  return {
    message: OTP_SENT_MESSAGE,
    requiresVerification: true,
    email: normalizedEmail,
  };
};

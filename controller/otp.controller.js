import User from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { assertValidEmail } from "../utils/emailValidation.js";
import {
  verifyFirebaseToken,
  resolveUserFromFirebase,
  linkFirebaseUid,
  assertEmailMobileNotRegisteredAsCustomer,
  CUSTOMER_ACCOUNT_MESSAGE,
} from "../utils/authHelpers.js";
import { saveEmailOtp, verifyEmailOtp, isGoogleSignIn } from "../utils/otpHelpers.js";
import { sendSellerVerificationOtp } from "../service/email.service.js";

const OTP_SENT_MESSAGE = "An OTP has been sent to your email, please verify.";

const sendOtpToSeller = async (email) => {
  const otp = await saveEmailOtp(email);
  await sendSellerVerificationOtp(email, otp);
};

export const sendSellerSignupOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, "Email is required");
  }

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }

  const user = await User.findOne({ email: normalizedEmail, role: "seller" });

  if (!user) {
    return sendError(res, "No seller account found. Please register first.", 404);
  }

  if (user.isVerified) {
    return sendError(res, "Email is already verified. Please sign in.", 400);
  }

  await sendOtpToSeller(normalizedEmail);

  sendSuccess(res, {
    message: OTP_SENT_MESSAGE,
    email: normalizedEmail,
  });
});

export const verifySellerSignupOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return sendError(res, "Email and verification code are required");
  }

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(email);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }

  const code = String(otp).trim();
  if (!/^\d{6}$/.test(code)) {
    return sendError(res, "Verification code must be a 6-digit number");
  }

  const user = await User.findOne({ email: normalizedEmail, role: "seller" });
  if (!user) {
    return sendError(res, "No seller account found. Please register first.", 404);
  }

  if (user.isVerified) {
    return sendSuccess(res, {
      message: "Email is already verified. You can sign in.",
      isVerified: true,
    });
  }

  try {
    await verifyEmailOtp(normalizedEmail, code);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }

  user.isVerified = true;
  await user.save();

  sendSuccess(res, {
    message: "Email verified successfully. You can now sign in.",
    isVerified: true,
  });
});

export const registerSellerAccount = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return sendError(res, "Firebase token is required");
  }

  let decoded;
  try {
    decoded = await verifyFirebaseToken(token);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 401);
  }

  if (!decoded.email) {
    return sendError(res, "A verified email address is required to register as a seller.", 400);
  }

  let normalizedEmail;
  try {
    normalizedEmail = assertValidEmail(decoded.email);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }

  let user = await resolveUserFromFirebase(decoded);

  if (user) {
    if (user.role === "customer") {
      return sendError(res, CUSTOMER_ACCOUNT_MESSAGE, 403);
    }

    if (user.role === "seller") {
      if (user.isVerified) {
        return sendError(res, "An account with this email already exists. Please sign in.", 400);
      }

      await linkFirebaseUid(user, decoded.uid);
      await sendOtpToSeller(normalizedEmail);

      return sendSuccess(res, {
        message: OTP_SENT_MESSAGE,
        requiresVerification: true,
        email: normalizedEmail,
      });
    }

    return sendError(res, "You are not eligible to register as a seller.", 403);
  }

  try {
    await assertEmailMobileNotRegisteredAsCustomer({ email: normalizedEmail });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 403);
  }

  const googleSignIn = isGoogleSignIn(decoded);

  user = await User.create({
    firebaseUid: decoded.uid,
    email: normalizedEmail,
    role: "seller",
    isVerified: googleSignIn,
  });

  if (googleSignIn) {
    return sendSuccess(res, {
      message: "Account created successfully.",
      requiresVerification: false,
      isVerified: true,
      email: normalizedEmail,
    });
  }

  await sendOtpToSeller(normalizedEmail);

  sendSuccess(res, {
    message: OTP_SENT_MESSAGE,
    requiresVerification: true,
    email: normalizedEmail,
  });
});

import crypto from "crypto";
import { appConfig } from "../../config/index.js";
import * as EmailOtpRepository from "../../repositories/emailOtp.repository.js";
import { createError } from "../AppError.js";

export const OTP_PURPOSES = {
  SELLER_SIGNUP: "seller_signup",
  CUSTOMER_LOGIN: "customer_login",
  SELLER_LOGIN: "seller_login",
  ADMIN_LOGIN: "admin_login",
  PASSWORD_RESET: "password_reset",
};

const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_RATE_WINDOW_MS = 15 * 60 * 1000;

const sendRateLimits = new Map();

export const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otp) =>
  crypto
    .createHash("sha256")
    .update(`${otp}:${appConfig.jwt.secret}`)
    .digest("hex");

const assertCanSendOtp = (email) => {
  const now = Date.now();
  const entry = sendRateLimits.get(email) || { count: 0, windowStart: now };

  if (now - entry.windowStart > SEND_RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  if (entry.count >= MAX_SENDS_PER_WINDOW) {
    throw createError(
      "Too many OTP requests. Please try again in a few minutes.",
      429
    );
  }

  entry.count += 1;
  sendRateLimits.set(email, entry);
};

export const saveEmailOtp = async (
  email,
  purpose = OTP_PURPOSES.SELLER_SIGNUP
) => {
  assertCanSendOtp(email);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await EmailOtpRepository.deleteMany({ email, purpose });

  await EmailOtpRepository.create({
    email,
    otpHash: hashOtp(otp),
    purpose,
    expiresAt,
  });

  return otp;
};

export const verifyEmailOtp = async (
  email,
  otp,
  purpose = OTP_PURPOSES.SELLER_SIGNUP
) => {
  const record = await EmailOtpRepository.findOne({ email, purpose });

  if (!record) {
    throw createError(
      "Verification code expired or not found. Please request a new one.",
      400
    );
  }

  if (record.expiresAt < new Date()) {
    await EmailOtpRepository.deleteOne({ _id: record._id });
    throw createError(
      "Verification code has expired. Please request a new one.",
      400
    );
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw createError(
      "Too many failed attempts. Please request a new verification code.",
      429
    );
  }

  if (hashOtp(otp) !== record.otpHash) {
    record.attempts += 1;
    await record.save();
    throw createError("Invalid verification code.", 400);
  }

  await EmailOtpRepository.deleteOne({ _id: record._id });
  return true;
};

export const isOAuthSignIn = (claims) =>
  claims?.sign_in_provider === "google.com" ||
  claims?.sign_in_provider === "apple.com";

// Backward-compatible alias
export const isGoogleSignIn = isOAuthSignIn;

export const getOtpExpirySeconds = () => OTP_EXPIRY_MINUTES * 60;

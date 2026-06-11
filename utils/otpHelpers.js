import crypto from "crypto";
import EmailOtp from "../models/EmailOtp.model.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_PURPOSE = "seller_signup";

export const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(`${otp}:${process.env.JWT_SECRET}`).digest("hex");

export const saveEmailOtp = async (email) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await EmailOtp.deleteMany({ email, purpose: OTP_PURPOSE });

  await EmailOtp.create({
    email,
    otpHash: hashOtp(otp),
    purpose: OTP_PURPOSE,
    expiresAt,
  });

  return otp;
};

export const verifyEmailOtp = async (email, otp) => {
  const record = await EmailOtp.findOne({ email, purpose: OTP_PURPOSE });

  if (!record) {
    const err = new Error("Verification code expired or not found. Please request a new one.");
    err.statusCode = 400;
    throw err;
  }

  if (record.expiresAt < new Date()) {
    await EmailOtp.deleteOne({ _id: record._id });
    const err = new Error("Verification code has expired. Please request a new one.");
    err.statusCode = 400;
    throw err;
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    const err = new Error("Too many failed attempts. Please request a new verification code.");
    err.statusCode = 429;
    throw err;
  }

  if (hashOtp(otp) !== record.otpHash) {
    record.attempts += 1;
    await record.save();
    const err = new Error("Invalid verification code.");
    err.statusCode = 400;
    throw err;
  }

  await EmailOtp.deleteOne({ _id: record._id });
  return true;
};

export const isGoogleSignIn = (decoded) =>
  decoded.firebase?.sign_in_provider === "google.com" ||
  decoded.firebase?.sign_in_provider === "apple.com";

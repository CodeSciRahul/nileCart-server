import bcrypt from "bcryptjs";
import { createError } from "../AppError.js";

const SALT_ROUNDS = 12;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);

export const assertValidPassword = (password) => {
  if (!password || typeof password !== "string") {
    throw createError("Password is required.", 400);
  }
  if (password.length < 6) {
    throw createError("Password must be at least 6 characters.", 400);
  }
  if (password.length > 128) {
    throw createError("Password must not exceed 128 characters.", 400);
  }
};

export const checkAccountLock = (user) => {
  if (!user?.lockUntil) return;

  const now = new Date();
  if (user.lockUntil > now) {
    const minutesLeft = Math.max(1, Math.ceil((user.lockUntil - now) / (60 * 1000)));
    throw createError(
      `Account is temporarily locked due to too many failed attempts. Please try again in ${minutesLeft} minute(s) or reset your password.`,
      429
    );
  }
};

export const recordFailedLogin = async (user) => {
  if (!user) return;

  const currentAttempts = (user.failedLoginAttempts || 0) + 1;
  user.failedLoginAttempts = currentAttempts;

  if (currentAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  await user.save();
};

export const recordSuccessfulLogin = async (user) => {
  if (!user) return;

  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }
};

export const verifyUserPassword = async (user, password) => {
  checkAccountLock(user);

  if (!user?.passwordHash) {
    throw createError("Invalid email or password.", 401);
  }

  const isMatch = await comparePassword(password, user.passwordHash);

  if (!isMatch) {
    await recordFailedLogin(user);
    throw createError("Invalid email or password.", 401);
  }

  await recordSuccessfulLogin(user);
};

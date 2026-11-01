import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../src/config/database.js";
import User from "../src/models/User.js";
import EmailOtp from "../src/models/EmailOtp.js";
import {
  hashPassword,
  comparePassword,
  assertValidPassword,
  checkAccountLock,
  recordFailedLogin,
  recordSuccessfulLogin,
  verifyUserPassword,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "../src/utils/helpers/passwordHelpers.js";
import * as AuthService from "../src/services/auth.service.js";

test.before(async () => {
  await connectDB();
});

test.after(async () => {
  // Clean up any test users
  await User.deleteMany({ email: { $regex: /^test_auth_.*@example\.com$/ } });
  await EmailOtp.deleteMany({ email: { $regex: /^test_auth_.*@example\.com$/ } });
  await mongoose.disconnect();
});

test("Password Helpers: hashing, comparison, and validation", async () => {
  const plain = "Aluma@1234";
  const hashed = await hashPassword(plain);

  assert.notEqual(hashed, plain);
  assert.equal(await comparePassword(plain, hashed), true);
  assert.equal(await comparePassword("WrongPassword123", hashed), false);

  assert.throws(() => assertValidPassword(""), /required/);
  assert.throws(() => assertValidPassword("12345"), /at least 6 characters/);
  assert.doesNotThrow(() => assertValidPassword("Aluma@1234"));
});

test("Brute force protection: lockout after 5 failed attempts", async () => {
  const testEmail = "test_auth_brute@example.com";
  await User.deleteOne({ email: testEmail });

  const testUser = await User.create({
    email: testEmail,
    name: "Brute Test",
    role: "customer",
    passwordHash: await hashPassword("ValidPass123!"),
    hasPassword: true,
  });

  // 4 failed attempts should not lock account
  for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
    await assert.rejects(
      async () => verifyUserPassword(testUser, "WrongPassword"),
      /Invalid email or password/
    );
  }
  assert.equal(testUser.failedLoginAttempts, 4);
  assert.equal(testUser.lockUntil, null);

  // 5th failed attempt should trigger lockout
  await assert.rejects(
    async () => verifyUserPassword(testUser, "WrongPassword"),
    /Invalid email or password/
  );
  assert.equal(testUser.failedLoginAttempts, 5);
  assert.ok(testUser.lockUntil && testUser.lockUntil > new Date());

  // Subsequent attempt while locked should throw locked message with 429
  await assert.rejects(
    async () => verifyUserPassword(testUser, "ValidPass123!"),
    /Account is temporarily locked/
  );

  // Successful login after lock resets lock
  testUser.lockUntil = null;
  await testUser.save();
  await verifyUserPassword(testUser, "ValidPass123!");
  assert.equal(testUser.failedLoginAttempts, 0);

  await User.deleteOne({ _id: testUser._id });
});

test("Admin login: successfully signs in with seeded Aluma@1234 password", async () => {
  const adminResult = await AuthService.loginAdmin({
    email: "admin@nilescart.com",
    password: "Aluma@1234",
  });

  assert.ok(adminResult.token);
  assert.equal(adminResult.user.email, "admin@nilescart.com");
  assert.equal(adminResult.user.role, "admin");
  assert.equal(adminResult.user.hasPassword, true);

  await assert.rejects(
    async () =>
      AuthService.loginAdmin({
        email: "admin@nilescart.com",
        password: "IncorrectPassword",
      }),
    /Invalid email or password/
  );
});

test("Lookup Auth Methods: identifies account existence and password status", async () => {
  const adminLookup = await AuthService.lookupAuthMethods({
    email: "admin@nilescart.com",
    role: "admin",
  });

  assert.equal(adminLookup.exists, true);
  assert.equal(adminLookup.hasPassword, true);
  assert.equal(adminLookup.role, "admin");

  const unknownLookup = await AuthService.lookupAuthMethods({
    email: "nonexistent_user_xyz@example.com",
  });
  assert.equal(unknownLookup.exists, false);
  assert.equal(unknownLookup.hasPassword, false);
});

test("Customer/Seller: set password, change password, and forgot password reset", async () => {
  const customerEmail = "test_auth_flow@example.com";
  await User.deleteOne({ email: customerEmail });

  // 1. Create a customer without password (as if created via OTP)
  let user = await User.create({
    email: customerEmail,
    name: "Flow Customer",
    role: "customer",
    hasPassword: false,
    isVerified: true,
  });

  const initialLookup = await AuthService.lookupAuthMethods({ email: customerEmail });
  assert.equal(initialLookup.hasPassword, false);

  // 2. Set password for user without password
  const setResult = await AuthService.setPassword(user, {
    password: "CustomerSecret123!",
    confirmPassword: "CustomerSecret123!",
  });
  assert.equal(setResult.success, true);
  assert.equal(setResult.hasPassword, true);

  // Verify lookup now shows hasPassword: true
  const updatedLookup = await AuthService.lookupAuthMethods({ email: customerEmail });
  assert.equal(updatedLookup.hasPassword, true);

  // Setting password again should fail
  await assert.rejects(
    async () =>
      AuthService.setPassword(user, {
        password: "AnotherPassword123!",
        confirmPassword: "AnotherPassword123!",
      }),
    /already been set/
  );

  // 3. Customer logs in with new password
  const loginResult = await AuthService.login({
    email: customerEmail,
    password: "CustomerSecret123!",
  });
  assert.ok(loginResult.token);
  assert.equal(loginResult.user.email, customerEmail);

  // 4. Change password with current password
  const changeResult = await AuthService.changePassword(user, {
    currentPassword: "CustomerSecret123!",
    newPassword: "UpdatedSecret456!",
    confirmPassword: "UpdatedSecret456!",
  });
  assert.equal(changeResult.success, true);

  // Login with old password fails
  await assert.rejects(
    async () =>
      AuthService.login({
        email: customerEmail,
        password: "CustomerSecret123!",
      }),
    /Invalid email or password/
  );

  // Login with new password succeeds
  const loginNewResult = await AuthService.login({
    email: customerEmail,
    password: "UpdatedSecret456!",
  });
  assert.ok(loginNewResult.token);

  // 5. Forgot password flow
  // Request reset OTP
  const forgotOtpResult = await AuthService.sendForgotPasswordOtp({ email: customerEmail });
  assert.equal(forgotOtpResult.success, true);

  // Find generated OTP in DB to simulate email receipt
  const otpRecord = await EmailOtp.findOne({
    email: customerEmail,
    purpose: "password_reset",
  });
  assert.ok(otpRecord);

  // Verify OTP
  // In tests we can compute the matching OTP or test reset directly
  // Let's create an OTP with known code to test verifyForgotPasswordOtp
  await EmailOtp.deleteMany({ email: customerEmail });
  const { saveEmailOtp } = await import("../src/utils/helpers/otpHelpers.js");
  const knownOtp = await saveEmailOtp(customerEmail, "password_reset");

  const verifyReset = await AuthService.verifyForgotPasswordOtp({
    email: customerEmail,
    otp: knownOtp,
  });
  assert.equal(verifyReset.success, true);
  assert.ok(verifyReset.resetToken);

  // Reset password using resetToken
  const resetResult = await AuthService.resetPassword({
    resetToken: verifyReset.resetToken,
    newPassword: "FinalResetPassword789!",
    confirmPassword: "FinalResetPassword789!",
  });
  assert.equal(resetResult.success, true);

  // Sign in with reset password succeeds
  const finalLogin = await AuthService.login({
    email: customerEmail,
    password: "FinalResetPassword789!",
  });
  assert.ok(finalLogin.token);

  await User.deleteOne({ _id: user._id });
  await EmailOtp.deleteMany({ email: customerEmail });
});


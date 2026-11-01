import { createAuthHandler } from "../utils/helpers/handlerHelpers.js";
import * as AuthService from "../services/auth.service.js";

export const login = createAuthHandler((req) =>
  AuthService.login({
    token: req.body.token,
    email: req.body.email,
    password: req.body.password,
  })
);

export const loginSeller = createAuthHandler((req) =>
  AuthService.loginSeller({
    token: req.body.token,
    email: req.body.email,
    password: req.body.password,
  })
);

export const loginAdmin = createAuthHandler((req) =>
  AuthService.loginAdmin({
    token: req.body.token,
    email: req.body.email,
    password: req.body.password,
    mobileNumber: req.body.mobileNumber,
  })
);

export const getProfile = createAuthHandler((req) => AuthService.getProfile(req.user));

export const updateProfile = createAuthHandler((req) =>
  AuthService.updateProfile(req.user, req.body)
);

export const logout = createAuthHandler(() => AuthService.logout());

export const deleteAccount = createAuthHandler((req) =>
  AuthService.deleteAccount(req.user)
);

export const lookupAuthMethods = createAuthHandler((req) =>
  AuthService.lookupAuthMethods({
    email: req.body.email,
    role: req.body.role || req.body.loginType,
  })
);

export const setPassword = createAuthHandler((req) =>
  AuthService.setPassword(req.user, {
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  })
);

export const changePassword = createAuthHandler((req) =>
  AuthService.changePassword(req.user, {
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
    confirmPassword: req.body.confirmPassword,
  })
);

export const sendForgotPasswordOtp = createAuthHandler((req) =>
  AuthService.sendForgotPasswordOtp({
    email: req.body.email,
    role: req.body.role || req.body.loginType,
  })
);

export const verifyForgotPasswordOtp = createAuthHandler((req) =>
  AuthService.verifyForgotPasswordOtp({
    email: req.body.email,
    otp: req.body.otp,
  })
);

export const resetPassword = createAuthHandler((req) =>
  AuthService.resetPassword({
    resetToken: req.body.resetToken,
    email: req.body.email,
    otp: req.body.otp,
    newPassword: req.body.newPassword,
    confirmPassword: req.body.confirmPassword,
  })
);

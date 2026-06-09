import { initFirebaseAdmin } from "../vendor/firebase.vendor.js";
import User from "../models/User.model.js";
import Seller from "../models/Seller.model.js";

export const CUSTOMER_ACCOUNT_MESSAGE =
  "This email or mobile number is already registered as a customer account. Customer accounts cannot become sellers. Please use a different email or mobile number.";

export const CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE =
  "Customer accounts cannot register as sellers. Please sign up with a different email or mobile number that is not used on the storefront.";

export const verifyFirebaseToken = async (token) => {
  if (!token) {
    const err = new Error("Firebase token is required");
    err.statusCode = 400;
    throw err;
  }

  const admin = initFirebaseAdmin();
  if (!admin.apps?.length) {
    const err = new Error("Firebase Admin is not configured on server");
    err.statusCode = 503;
    throw err;
  }

  return admin.auth().verifyIdToken(token);
};

export const loadSellerProfile = (userId) => Seller.findOne({ user: userId });

export const isStorefrontCustomer = (user) => user?.role === "customer";

export const findUserByIdentity = async ({ firebaseUid, email, mobileNumber }) => {
  if (firebaseUid) {
    const byUid = await User.findOne({ firebaseUid });
    if (byUid) return byUid;
  }

  if (email) {
    const byEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (byEmail) return byEmail;
  }

  if (mobileNumber) {
    const byMobile = await User.findOne({ mobileNumber: mobileNumber.trim() });
    if (byMobile) return byMobile;
  }

  return null;
};

export const linkFirebaseUid = async (user, firebaseUid) => {
  if (user && !user.firebaseUid) {
    user.firebaseUid = firebaseUid;
    await user.save();
  }
};

export const resolveUserFromFirebase = async (decoded, mobileNumber) => {
  let user = await findUserByIdentity({
    firebaseUid: decoded.uid,
    email: decoded.email,
    mobileNumber: mobileNumber || decoded.phone_number,
  });

  if (user) {
    await linkFirebaseUid(user, decoded.uid);
    return user;
  }

  if (mobileNumber) {
    user = await findUserByIdentity({ mobileNumber });
    if (user) {
      await linkFirebaseUid(user, decoded.uid);
      return user;
    }
  }

  return null;
};

/** Block if email or mobile is already used by a storefront customer account */
export const assertEmailMobileNotRegisteredAsCustomer = async ({
  email,
  mobileNumber,
  excludeUserId,
}) => {
  const queries = [];

  if (email) {
    queries.push({ email: email.toLowerCase().trim() });
  }
  if (mobileNumber) {
    queries.push({ mobileNumber: mobileNumber.trim() });
  }

  for (const query of queries) {
    const existing = await User.findOne(query);
    if (!existing) continue;
    if (excludeUserId && String(existing._id) === String(excludeUserId)) continue;

    if (isStorefrontCustomer(existing)) {
      const err = new Error(CUSTOMER_ACCOUNT_MESSAGE);
      err.statusCode = 403;
      throw err;
    }
  }
};

/** Migrate legacy pending applicants (customer + seller profile) to seller role */
export const normalizeSellerDashboardUser = async (user) => {
  if (!user) return user;

  if (user.role === "customer") {
    const seller = await loadSellerProfile(user._id);
    if (seller) {
      user.role = "seller";
      await user.save();
      return user;
    }

    const err = new Error(CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE);
    err.statusCode = 403;
    throw err;
  }

  return user;
};

export const assertCanAccessSellerAuth = async (user) => {
  if (user.role === "admin") {
    const err = new Error("This account is an admin account. Please use admin login.");
    err.statusCode = 403;
    throw err;
  }

  if (user.role === "seller") {
    return user;
  }

  return normalizeSellerDashboardUser(user);
};

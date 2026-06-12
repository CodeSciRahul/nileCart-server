import mongoose from "mongoose";
import { appConfig } from "../config/appConfig.js";
import { connectDB } from "../config/db.js";
import { initFirebaseAdmin } from "../vendor/firebase.vendor.js";
import User from "../models/User.model.js";

/**
 * Seeds the first platform admin in Firebase Auth + MongoDB.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secretpassword npm run seed:admin
 *
 * Optional:
 *   ADMIN_NAME="Platform Admin"
 *
 * Password is stored in Firebase Auth only — never in MongoDB.
 */
const seedAdmin = async () => {
  const email = appConfig.admin.email?.toLowerCase();
  const password = appConfig.admin.password;
  const name = appConfig.admin.name;

  if (!email) {
    console.error("Error: ADMIN_EMAIL is required.");
    process.exit(1);
  }

  if (!password) {
    console.error("Error: ADMIN_PASSWORD is required.");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Error: ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  const firebaseAdmin = initFirebaseAdmin();
  if (!firebaseAdmin.apps?.length) {
    console.error(
      "Error: Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
    process.exit(1);
  }

  await connectDB();

  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    console.error(
      `Error: An admin already exists (${existingAdmin.email}). Only one admin is allowed.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.error(
      `Error: A user with email ${email} already exists with role "${existingUser.role}".`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let firebaseUser;

  try {
    firebaseUser = await firebaseAdmin.auth().getUserByEmail(email);
    console.log(`Firebase user already exists for ${email} (uid: ${firebaseUser.uid}).`);

    const linkedUser = await User.findOne({ firebaseUid: firebaseUser.uid });
    if (linkedUser) {
      console.error(`Error: Firebase UID is already linked to ${linkedUser.email}.`);
      await mongoose.disconnect();
      process.exit(1);
    }
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      throw err;
    }

    firebaseUser = await firebaseAdmin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
    console.log(`Firebase admin user created (uid: ${firebaseUser.uid}).`);
  }

  const mongoUser = await User.create({
    firebaseUid: firebaseUser.uid,
    email,
    name,
    role: "admin",
    isVerified: true,
    isActive: true,
  });

  console.log("\nAdmin seeded successfully:");
  console.log(`  Email:        ${mongoUser.email}`);
  console.log(`  Name:         ${mongoUser.name}`);
  console.log(`  Firebase UID: ${mongoUser.firebaseUid}`);
  console.log(`  MongoDB ID:   ${mongoUser._id}`);
  console.log("\nSign in via the dashboard admin tab. Password lives in Firebase Auth only.");

  await mongoose.disconnect();
};

seedAdmin().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

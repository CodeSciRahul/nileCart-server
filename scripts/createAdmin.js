import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.model.js";

/**
 * Creates the single platform admin user in MongoDB.
 * The admin must already exist in Firebase Auth (create manually in Firebase Console).
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_NAME="Platform Admin" npm run create-admin
 *
 * On first login with that Firebase account, the server links firebaseUid automatically.
 */
const createAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const name = process.env.ADMIN_NAME || process.argv[3] || "Admin";

  if (!email) {
    console.error("Error: ADMIN_EMAIL is required.");
    console.error("Usage: ADMIN_EMAIL=admin@example.com npm run create-admin");
    process.exit(1);
  }

  await connectDB();

  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    console.error(`Error: An admin already exists (${existingAdmin.email}). Only one admin is allowed.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    existingEmail.role = "admin";
    existingEmail.name = name;
    await existingEmail.save();
    console.log(`Updated existing user to admin: ${existingEmail.email}`);
  } else {
    await User.create({
      email: email.toLowerCase(),
      name,
      role: "admin",
    });
    console.log(`Admin user created: ${email}`);
  }

  console.log("Hand over Firebase credentials to the admin for login.");
  await mongoose.disconnect();
};

createAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});

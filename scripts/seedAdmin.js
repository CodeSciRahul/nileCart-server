import mongoose from "mongoose";
import { appConfig, connectDB } from "../src/config/index.js";
import { hashPassword } from "../src/utils/helpers/passwordHelpers.js";
import { generateAuthUid } from "../src/utils/helpers/authHelpers.js";
import User from "../src/models/User.js";

/**
 * Seeds the first platform admin in MongoDB.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secretpassword npm run seed:admin
 *
 * Optional:
 *   ADMIN_NAME="Platform Admin"
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

  await connectDB();

  const passwordHash = await hashPassword(password);

  const existingAdmin = await User.findOne({ role: "admin" }).select("+passwordHash");
  if (existingAdmin) {
    existingAdmin.passwordHash = passwordHash;
    existingAdmin.hasPassword = true;
    existingAdmin.isVerified = true;
    existingAdmin.isActive = true;
    if (name) existingAdmin.name = name;
    await existingAdmin.save();

    console.log("\nAdmin updated successfully:");
    console.log(`  Email:      ${existingAdmin.email}`);
    console.log(`  Name:       ${existingAdmin.name}`);
    console.log(`  MongoDB ID: ${existingAdmin._id}`);
    console.log(`  hasPassword: true`);
    console.log("\nSign in via the dashboard admin tab using email and password.");

    await mongoose.disconnect();
    return;
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.error(
      `Error: A user with email ${email} already exists with role "${existingUser.role}".`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const mongoUser = await User.create({
    firebaseUid: generateAuthUid(),
    email,
    name,
    role: "admin",
    isVerified: true,
    isActive: true,
    passwordHash,
    hasPassword: true,
    authProvider: "password",
  });

  console.log("\nAdmin seeded successfully:");
  console.log(`  Email:      ${mongoUser.email}`);
  console.log(`  Name:       ${mongoUser.name}`);
  console.log(`  MongoDB ID: ${mongoUser._id}`);
  console.log("\nSign in via the dashboard admin tab using email and password.");

  await mongoose.disconnect();
};

seedAdmin().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

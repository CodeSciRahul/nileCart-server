import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    birthday: Date,
    name: {
      type: String,
      maxlength: 50,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    categoryPreferences: {
      type: [String],
      default: [],
    },
    avatar: storedImageSchema,
    role: {
      type: String,
      enum: ["customer", "seller", "admin"],
      default: "customer",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;

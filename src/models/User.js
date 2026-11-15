import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    hasPassword: {
      type: Boolean,
      default: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["password", "google.com", "apple.com"],
      default: "password",
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

userSchema.pre("save", function () {
  if (this.isModified("passwordHash")) {
    this.hasPassword = Boolean(this.passwordHash);
  }
});

const User = mongoose.model("User", userSchema);
export default User;

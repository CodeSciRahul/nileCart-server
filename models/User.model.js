import mongoose from "mongoose";

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
    avatar: String,
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;

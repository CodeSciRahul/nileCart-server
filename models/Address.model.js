import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    pincode: { type: String, required: true },
    addressLine: { type: String, required: true },
    locality: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: "India" },
    addressType: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);
export default Address;

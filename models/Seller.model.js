import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";

const sellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    storeName: {
      type: String,
      required: true,
      trim: true,
    },
    storeSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    logo: storedImageSchema,
    banner: storedImageSchema,
    description: String,
    tinNumber: {
      type: String,
      trim: true,
    },
    nationalId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },  
    address: {
      addressLine: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true, required: true },
      accountNumber: { type: String, trim: true, required: true },
      ifscCode: { type: String, trim: true, required: true },
    },
    commissionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    documents: {
      idProof: [String],
      businessProof: [String],
      addressProof: [String],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

sellerSchema.index({ storeName: "text", description: "text" });
sellerSchema.index({ isActive: 1, isVerified: 1 });

const Seller = mongoose.model("Seller", sellerSchema);
export default Seller;

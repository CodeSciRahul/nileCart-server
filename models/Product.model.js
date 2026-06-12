import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    size: String,
    color: String,
    colorHex: String,
    stock: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    images: [storedImageSchema],
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: String,
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },
    images: [storedImageSchema],
    variants: {
      type: [variantSchema],
      validate: [(v) => v.length > 0, "At least one variant is required"],
    },
    tags: [String],
    gender: {
      type: String,
      enum: ["Women", "Men"],
      default: "Women",
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    isTrending: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ title: "text", tags: "text", description: "text" });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isTrending: 1, isActive: 1 });
const Product = mongoose.model("Product", productSchema);
export default Product;

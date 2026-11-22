import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";
import { HOME_SECTION_TYPES, PRODUCT_SOURCES } from "../constants/homeSections.js";

const homeSectionItemSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    caption: { type: String, default: "" },
    price: { type: String, default: "" },
    kicker: { type: String, default: "" },
    image: storedImageSchema,
    link: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const homeSectionConfigSchema = new mongoose.Schema(
  {
    source: { type: String, default: "all_active" },
    productSource: {
      type: String,
      enum: PRODUCT_SOURCES,
      default: "trending",
    },
    layout: {
      type: String,
      enum: ["carousel", "grid", "strip", "banner", "popup"],
      default: "grid",
    },
    limit: { type: Number, default: 8, min: 1, max: 48 },
    bannerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Banner" }],
    announcementIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Announcement" },
    ],
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    flashSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "FlashSale" },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection" },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    brandIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Brand" }],
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    popupFrequency: {
      type: String,
      enum: ["once", "session", "always"],
      default: "session",
    },
    deepLink: String,
  },
  { _id: false }
);

const homeSectionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      required: true,
      enum: HOME_SECTION_TYPES,
    },
    title: { type: String, trim: true, default: "" },
    subtitle: { type: String, trim: true, default: "" },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    backgroundColor: String,
    textColor: String,
    ctaText: String,
    ctaLink: String,
    image: storedImageSchema,
    items: [homeSectionItemSchema],
    config: { type: homeSectionConfigSchema, default: () => ({}) },
  },
  { timestamps: true }
);

homeSectionSchema.index({ isActive: 1, displayOrder: 1 });
homeSectionSchema.index({ type: 1, isActive: 1 });

const HomeSection = mongoose.model("HomeSection", homeSectionSchema);
export default HomeSection;

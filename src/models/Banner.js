import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";
import { deepLinkSchema } from "./schemas/deepLink.schema.js";
import {
  targetingSchema,
  defaultTargeting,
} from "./schemas/targeting.schema.js";
import { BANNER_TYPES } from "../constants/marketing.js";

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    subtitle: String,
    description: String,
    type: {
      type: String,
      enum: BANNER_TYPES,
      default: "hero",
      index: true,
    },
    image: { type: storedImageSchema },
    mobileImage: { type: storedImageSchema },
    ctaText: { type: String, default: "Shop Now" },
    /** Legacy flat URL — kept in sync from deepLink when possible. */
    ctaLink: String,
    deepLink: { type: deepLinkSchema },
    displayOrder: { type: Number, default: 0 },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    targeting: {
      type: targetingSchema,
      default: defaultTargeting,
    },
  },
  { timestamps: true }
);

bannerSchema.index({ isActive: 1, type: 1, displayOrder: 1 });
bannerSchema.index({ startsAt: 1, endsAt: 1 });

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;

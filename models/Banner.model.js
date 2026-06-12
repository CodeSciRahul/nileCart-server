import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: String,
    description: String,
    image: { type: storedImageSchema },
    ctaText: { type: String, default: "Shop Now" },
    ctaLink: String,
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true }
);

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;

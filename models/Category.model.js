import mongoose from "mongoose";
import { storedImageSchema } from "./schemas/storedImage.schema.js";
import { DEPARTMENT_VALUES } from "../constants/departments.js";

const categorySchema = new mongoose.Schema(
  {
    name: {
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
    image: storedImageSchema,
    description: String,
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    department: {
      type: String,
      enum: DEPARTMENT_VALUES,
      default: null,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    showInNav: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

categorySchema.index({ parent: 1, isActive: 1, displayOrder: 1 });
categorySchema.index({ department: 1, isActive: 1, displayOrder: 1 });

const Category = mongoose.model("Category", categorySchema);
export default Category;

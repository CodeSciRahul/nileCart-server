import mongoose from "mongoose";

/**
 * Reusable S3-backed image reference.
 * `url` is the public URL; `key` is the S3 object key used for deletion.
 */
export const storedImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
    },
    key: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

import mongoose from "mongoose";
import { appConfig } from "./appConfig.js";

export const connectDB = async () => {
  const uri = appConfig.mongodb.uri;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected");
};

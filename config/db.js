import mongoose from "mongoose";
import { appConfig } from "./appConfig.js";
import process from "process"

export const connectDB = async () => {
  const uri = appConfig.mongodb.uri;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error to connect db", error?.message)
    process.exit()
  }
}

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { appConfig } from "./config/appConfig.js";
import { connectDB } from "./config/db.js";
import { initFirebaseAdmin } from "./vendor/firebase.vendor.js";
import apiRoutes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();
const PORT = appConfig.port;

initFirebaseAdmin();

const allowedOrigins = [
  appConfig.clientUrl,
  appConfig.storefrontUrl,
  ...(appConfig.clientUrl?.split(",").map((o) => o.trim()) || []),
].filter(Boolean);

app.use(
  cors({
    origin: appConfig.clientUrl.split(",").map((url) => url.trim()),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRoutes);

app.get("/", async (req, res) => {
  res.send("Server is running...")
})

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

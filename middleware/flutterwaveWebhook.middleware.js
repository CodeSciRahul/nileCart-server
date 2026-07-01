import crypto from "crypto";
import { appConfig } from "../config/appConfig.js";
import { sendError } from "../utils/apiResponse.js";

const safeCompare = (a, b) => {
  if (!a || !b) return false;

  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Validates incoming Flutterwave webhook requests.
 * v3 sends a plain `verif-hash` header matching your dashboard secret hash.
 */
export const verifyFlutterwaveWebhook = (req, res, next) => {
  const secret = appConfig.flutterwave.webhookSecret;

  if (!secret) {
    console.error("[webhook] FLUTTERWAVE_WEBHOOK_SECRET is not configured");
    return sendError(res, "Webhook verification is not configured", 503);
  }

  const headerHash =
    req.headers["verif-hash"] ||
    req.headers["Verif-Hash"] ||
    req.headers["x-flutterwave-signature"];

  if (!headerHash || !safeCompare(headerHash, secret)) {
    console.warn("[webhook] Rejected Flutterwave webhook — invalid verif-hash");
    return sendError(res, "Unauthorized webhook", 401);
  }

  next();
};

import { Router } from "express";
import { handleFlutterwaveWebhook } from "../controller/payment.controller.js";
import { verifyFlutterwaveWebhook } from "../middleware/flutterwaveWebhook.middleware.js";

const router = Router();

router.post("/flutterwave", verifyFlutterwaveWebhook, handleFlutterwaveWebhook);

export default router;

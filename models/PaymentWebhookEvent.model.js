import mongoose from "mongoose";

const paymentWebhookEventSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: String,
    txRef: String,
    transactionId: String,
    payload: mongoose.Schema.Types.Mixed,
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const PaymentWebhookEvent = mongoose.model(
  "PaymentWebhookEvent",
  paymentWebhookEventSchema
);

export default PaymentWebhookEvent;

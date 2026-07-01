import crypto from "crypto";
import Order from "../models/Order.model.js";
import Product from "../models/Product.model.js";
import PaymentWebhookEvent from "../models/PaymentWebhookEvent.model.js";
import { findVariant } from "./productHelpers.js";
import { restoreCouponOnCancel } from "./couponHelpers.js";
import { appConfig } from "../config/appConfig.js";

const SUCCESS_STATUSES = new Set(["successful", "succeeded", "success"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "canceled"]);
const VERIFICATION_SOURCES = new Set(["redirect", "webhook", "manual", "system"]);

export const restoreOrderStock = async (order) => {
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;

    const variant = findVariant(product, item.variantSku);
    if (variant) {
      variant.stock += item.quantity;
    }

    await product.save();
  }
};

export const amountsMatch = (expected, received, currency) => {
  const expectedNum = Number(expected);
  const receivedNum = Number(received);

  if (!Number.isFinite(expectedNum) || !Number.isFinite(receivedNum)) {
    return false;
  }

  const zeroDecimalCurrencies = new Set(["UGX", "RWF", "JPY", "KRW"]);
  if (zeroDecimalCurrencies.has(String(currency || appConfig.payment.currency).toUpperCase())) {
    return Math.round(expectedNum) === Math.round(receivedNum);
  }

  return Math.abs(expectedNum - receivedNum) < 0.01;
};

const normalizeVerificationPayload = (verification) => {
  const data = verification?.data ?? verification ?? {};

  return {
    transactionId: data.id != null ? String(data.id) : undefined,
    txRef: data.tx_ref || data.reference,
    flwRef: data.flw_ref || data.flw_ref_id,
    status: String(data.status || "").toLowerCase(),
    amount: data.amount ?? data.charged_amount,
    currency: data.currency || appConfig.payment.currency,
    channel: data.payment_type || data.payment_method?.type,
    processorResponse: data.processor_response,
    customerEmail: data.customer?.email,
  };
};

export const isPaymentSuccessful = (status) => SUCCESS_STATUSES.has(String(status).toLowerCase());

export const isPaymentFailed = (status) => FAILED_STATUSES.has(String(status).toLowerCase());

/**
 * Apply a verified Flutterwave transaction to an order.
 * Idempotent — safe to call from redirect handler and webhooks.
 */
export const applyPaymentVerification = async (order, verification, source = "redirect") => {
  if (!order) {
    throw Object.assign(new Error("Order not found for payment verification"), {
      statusCode: 404,
    });
  }

  if (order.paymentStatus === "paid") {
    return { order, alreadyPaid: true };
  }

  const normalized = normalizeVerificationPayload(verification);

  if (!normalized.txRef || normalized.txRef !== order.flutterwave?.txRef) {
    throw Object.assign(new Error("Payment reference does not match this order"), {
      statusCode: 400,
    });
  }

  if (!amountsMatch(order.total, normalized.amount, normalized.currency)) {
    throw Object.assign(
      new Error("Payment amount does not match order total. Contact support."),
      { statusCode: 400 }
    );
  }

  if (isPaymentSuccessful(normalized.status)) {
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.flutterwave = {
      ...order.flutterwave?.toObject?.() ?? order.flutterwave ?? {},
      txRef: normalized.txRef,
      transactionId: normalized.transactionId,
      flwRef: normalized.flwRef,
      channel: normalized.channel,
      currency: normalized.currency,
      paidAt: new Date(),
      verifiedAt: new Date(),
      lastVerificationSource: source,
    };
    order.statusHistory.push({
      status: "confirmed",
      note: `Payment confirmed via ${source}`,
    });

    await order.save();
    return { order, alreadyPaid: false, paid: true };
  }

  if (isPaymentFailed(normalized.status)) {
    await failPaymentAndCancelOrder(order, `Payment ${normalized.status}`, source);
    return { order, paid: false, failed: true };
  }

  throw Object.assign(
    new Error(`Payment is still processing (status: ${normalized.status || "unknown"})`),
    { statusCode: 409 }
  );
};

export const failPaymentAndCancelOrder = async (order, reason, source = "system") => {
  if (order.paymentStatus === "paid") {
    return order;
  }

  if (order.orderStatus !== "cancelled") {
    await restoreOrderStock(order);
    await restoreCouponOnCancel(order);

    order.paymentStatus = "failed";
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason = reason;
    order.statusHistory.push({
      status: "cancelled",
      note: `${reason} (${source})`,
    });
  } else {
    order.paymentStatus = "failed";
  }

  if (order.flutterwave && VERIFICATION_SOURCES.has(source)) {
    order.flutterwave.lastVerificationSource = source;
    order.flutterwave.verifiedAt = new Date();
  }

  await order.save();
  return order;
};

export const recordWebhookEvent = async ({
  eventId,
  eventType,
  txRef,
  transactionId,
  payload,
}) => {
  const dedupeKey =
    eventId ||
    transactionId ||
    txRef ||
    crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  try {
    await PaymentWebhookEvent.create({
      eventKey: dedupeKey,
      eventType,
      txRef,
      transactionId,
      payload,
    });
    return { duplicate: false };
  } catch (err) {
    if (err.code === 11000) {
      return { duplicate: true };
    }
    throw err;
  }
};

export const findOrderByPaymentReference = async (txRef) => {
  if (!txRef) return null;
  return Order.findOne({ "flutterwave.txRef": txRef });
};

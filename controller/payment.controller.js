import User from "../models/User.model.js";
import Order from "../models/Order.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { appConfig } from "../config/appConfig.js";
import { buildOrderFromCart } from "../utils/orderBuilder.js";
import {
  applyPaymentVerification,
  failPaymentAndCancelOrder,
  findOrderByPaymentReference,
  recordWebhookEvent,
} from "../utils/paymentHelpers.js";
import {
  generatePaymentReference,
  initiateStandardCheckout,
  verifyTransaction,
  verifyTransactionByReference,
  getFlutterwaveCapabilities,
  FlutterwaveServiceError,
} from "../service/flutterWave.service.js";
import { isFlutterwaveV3Configured } from "../vendor/flutterWave.vendor.js";

const buildRedirectUrl = () =>
  `${appConfig.storefrontUrl.replace(/\/$/, "")}/checkout/payment/callback`;

const formatOrderForClient = (order) => ({
  _id: order._id,
  orderNumber: order.orderNumber,
  total: order.total,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  orderStatus: order.orderStatus,
});

/**
 * POST /payments/checkout
 * Creates a pending order and returns a Flutterwave hosted checkout URL.
 */
export const initializeCheckout = asyncHandler(async (req, res) => {
  if (!isFlutterwaveV3Configured()) {
    return sendError(
      res,
      "Online payments are not configured. Set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY.",
      503
    );
  }

  const { addressId } = req.body;
  if (!addressId) {
    return sendError(res, "Shipping address is required", 400);
  }

  const txRef = generatePaymentReference("ORD");

  let order;
  try {
    order = await buildOrderFromCart(req.user._id, {
      addressId,
      paymentMethod: "card",
      paymentTxRef: txRef,
    });
    console.log("order", order);
  } catch (err) {
    console.log("error", err);
    return sendError(res, err.message, err.statusCode || 500);
  }

  const user = await User.findById(req.user._id).select("email name");

  try {
    const checkout = await initiateStandardCheckout({
      txRef,
      amount: order.total,
      currency: appConfig.payment.currency,
      redirectUrl: buildRedirectUrl(),
      customer: {
        email: user?.email,
        phonenumber: order.shippingAddress?.mobileNumber,
        name: order.shippingAddress?.fullName || user?.name,
      },
      customizations: {
        title: "NileCart",
        description: `Order ${order.orderNumber}`,
        logo: appConfig.payment.logoUrl,
      },
      paymentOptions: appConfig.payment.options,
      meta: {
        order_id: String(order._id),
        order_number: order.orderNumber,
        user_id: String(req.user._id),
      },
    });

    const checkoutUrl = checkout?.link;
    if (!checkoutUrl) {
      await failPaymentAndCancelOrder(order, "Checkout initialization failed", "system");
      return sendError(res, "Could not initialize payment checkout", 502);
    }

    order.flutterwave = {
      ...order.flutterwave?.toObject?.() ?? order.flutterwave ?? {},
      txRef,
      checkoutUrl,
      currency: appConfig.payment.currency,
    };
    await order.save();

    sendSuccess(res, {
      order: formatOrderForClient(order),
      checkoutUrl,
      txRef,
    });
  } catch (err) {
    await failPaymentAndCancelOrder(
      order,
      err.message || "Payment initialization failed",
      "system"
    );

    const statusCode = err instanceof FlutterwaveServiceError ? err.statusCode : 502;
    return sendError(res, err.message || "Could not initialize payment", statusCode);
  }
});

/**
 * GET /payments/verify?tx_ref=&transaction_id=
 * Verifies payment after Flutterwave redirect (server-side verification required).
 */
export const verifyCheckoutPayment = asyncHandler(async (req, res) => {
  const txRef = req.query.tx_ref || req.query.txRef;
  const transactionId = req.query.transaction_id || req.query.transactionId;

  if (!txRef) {
    return sendError(res, "Payment reference (tx_ref) is required", 400);
  }

  const order = await Order.findOne({
    "flutterwave.txRef": txRef,
    user: req.user._id,
  });

  if (!order) {
    return sendError(res, "Order not found for this payment reference", 404);
  }

  const redirectStatus = req.query.status;
  if (redirectStatus === "cancelled" || redirectStatus === "canceled") {
    await failPaymentAndCancelOrder(order, "Payment cancelled by customer", "redirect");
    return sendSuccess(res, {
      order: formatOrderForClient(order),
      failed: true,
      cancelled: true,
    });
  }

  if (order.paymentStatus === "paid") {
    return sendSuccess(res, {
      order: formatOrderForClient(order),
      alreadyPaid: true,
    });
  }

  try {
    const verification = transactionId
      ? await verifyTransaction(transactionId)
      : await verifyTransactionByReference(txRef);

    const result = await applyPaymentVerification(order, verification, "redirect");

    sendSuccess(res, {
      order: formatOrderForClient(result.order),
      alreadyPaid: result.alreadyPaid,
      paid: result.paid,
      failed: result.failed,
    });
  } catch (err) {
    const statusCode = err.statusCode || 502;

    if (statusCode === 409) {
      return sendError(res, err.message, 409);
    }

    if (statusCode === 400) {
      await failPaymentAndCancelOrder(order, err.message, "redirect");
    }

    return sendError(res, err.message || "Payment verification failed", statusCode);
  }
});

/**
 * POST /payments/retry/:orderId
 * Re-initiate checkout for a pending online order.
 */
export const retryCheckout = asyncHandler(async (req, res) => {
  if (!isFlutterwaveV3Configured()) {
    return sendError(res, "Online payments are not configured", 503);
  }

  const order = await Order.findOne({
    _id: req.params.orderId,
    user: req.user._id,
    paymentMethod: "card",
    paymentStatus: "pending",
    orderStatus: { $ne: "cancelled" },
  });

  if (!order) {
    return sendError(res, "No pending online order found to retry", 404);
  }

  const txRef = generatePaymentReference("ORD");
  const user = await User.findById(req.user._id).select("email name");

  try {
    const checkout = await initiateStandardCheckout({
      txRef,
      amount: order.total,
      currency: appConfig.payment.currency,
      redirectUrl: buildRedirectUrl(),
      customer: {
        email: user?.email,
        phonenumber: order.shippingAddress?.mobileNumber,
        name: order.shippingAddress?.fullName || user?.name,
      },
      customizations: {
        title: "NileCart",
        description: `Order ${order.orderNumber}`,
      },
      paymentOptions: appConfig.payment.options,
      meta: {
        order_id: String(order._id),
        order_number: order.orderNumber,
        user_id: String(req.user._id),
        retry: true,
      },
    });

    order.flutterwave = {
      ...order.flutterwave?.toObject?.() ?? order.flutterwave ?? {},
      txRef,
      checkoutUrl: checkout.link,
      currency: appConfig.payment.currency,
    };
    await order.save();

    sendSuccess(res, {
      order: formatOrderForClient(order),
      checkoutUrl: checkout.link,
      txRef,
    });
  } catch (err) {
    const statusCode = err instanceof FlutterwaveServiceError ? err.statusCode : 502;
    return sendError(res, err.message || "Could not retry payment", statusCode);
  }
});

/**
 * GET /payments/config
 * Public payment configuration for the storefront.
 */
export const getPaymentConfig = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    currency: appConfig.payment.currency,
    currencySymbol: appConfig.payment.currencySymbol,
    onlinePaymentsEnabled: isFlutterwaveV3Configured(),
    capabilities: getFlutterwaveCapabilities(),
    paymentOptions: appConfig.payment.options.split(","),
  });
});

/**
 * POST /webhooks/flutterwave
 * Flutterwave webhook handler — must respond 200 for valid events.
 */
export const handleFlutterwaveWebhook = asyncHandler(async (req, res) => {
  const payload = req.body;
  const eventType = payload?.event || payload?.type;
  const data = payload?.data;
  console.log("webhook triggered", req?.body)

  if (!eventType || !data) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const txRef = data.tx_ref || data.reference;
  const transactionId = data.id != null ? String(data.id) : undefined;
  const webhookId = payload.id || payload.webhook_id;

  const { duplicate } = await recordWebhookEvent({
    eventId: webhookId,
    eventType,
    txRef,
    transactionId,
    payload,
  });

  if (duplicate) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  const completedEvents = new Set(["charge.completed", "charge.succeeded"]);
  if (!completedEvents.has(eventType)) {
    return res.status(200).json({ received: true, event: eventType, handled: false });
  }

  const order = await findOrderByPaymentReference(txRef);
  if (!order) {
    console.warn(`[webhook] No order for tx_ref=${txRef}`);
    return res.status(200).json({ received: true, orderFound: false });
  }

  try {
    let verification = { data };

    if (transactionId && isFlutterwaveV3Configured()) {
      try {
        verification = await verifyTransaction(transactionId);
      } catch (verifyErr) {
        console.warn("[webhook] Server verify fallback to payload:", verifyErr.message);
      }
    }

    await applyPaymentVerification(order, verification, "webhook");
    return res.status(200).json({ received: true, handled: true });
  } catch (err) {
    console.error("[webhook] Processing error:", err.message);

    if (err.statusCode === 409) {
      return res.status(200).json({ received: true, pending: true });
    }

    return res.status(200).json({ received: true, error: err.message });
  }
});

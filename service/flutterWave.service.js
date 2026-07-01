import crypto from "crypto";
import { appConfig } from "../config/appConfig.js";
import {
  encryptFlutterwaveValue,
  flutterwaveV3Request,
  flutterwaveV4Request,
  generateFlutterwaveIdempotencyKey,
  generateFlutterwaveTraceId,
  getFlutterwaveClient,
  isFlutterwaveV3Configured,
  isFlutterwaveV4Configured,
} from "../vendor/flutterWave.vendor.js";
import {
  assertFlutterwaveConfigured,
  assertFlutterwaveV4Configured,
  FlutterwaveServiceError,
  unwrapFlutterwaveResponse,
} from "../utils/flutterwaveErrors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export { FlutterwaveServiceError };

export const generatePaymentReference = (prefix = "NC") =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

const withV4Defaults = (options = {}) => ({
  traceId: options.traceId || generateFlutterwaveTraceId(),
  idempotencyKey: options.idempotencyKey || generateFlutterwaveIdempotencyKey(),
  ...options,
});

const callV3Sdk = async (fn) => {
  const client = getFlutterwaveClient();

  if (!client) {
    assertFlutterwaveConfigured();
  }

  const { body } = await fn(client);
  return unwrapFlutterwaveResponse({ body, httpStatus: 200 });
};

// ---------------------------------------------------------------------------
// Customers (Flutterwave v4)
// ---------------------------------------------------------------------------

/**
 * Create a Flutterwave customer profile (v4).
 * @see https://developer.flutterwave.com/docs/customers
 */
export const createCustomer = async (payload, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId, idempotencyKey } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "POST",
    path: "/customers",
    body: payload,
    traceId,
    idempotencyKey,
  });
};

/**
 * List Flutterwave customers (v4).
 */
export const listCustomers = async ({ page = 1, size = 10 } = {}, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "GET",
    path: "/customers",
    query: { page, size },
    traceId,
  });
};

/**
 * Retrieve a single Flutterwave customer by ID (v4).
 */
export const getCustomer = async (customerId, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "GET",
    path: `/customers/${customerId}`,
    traceId,
  });
};

/**
 * Update a Flutterwave customer (v4).
 */
export const updateCustomer = async (customerId, payload, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId, idempotencyKey } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "PUT",
    path: `/customers/${customerId}`,
    body: payload,
    traceId,
    idempotencyKey,
  });
};

// ---------------------------------------------------------------------------
// Payment methods (Flutterwave v4)
// ---------------------------------------------------------------------------

/**
 * Create a payment method (card, mobile_money, ussd, opay, etc.) — v4.
 * Card payloads must include encrypted fields per Flutterwave docs.
 */
export const createPaymentMethod = async (payload, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId, idempotencyKey } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "POST",
    path: "/payment-methods",
    body: payload,
    traceId,
    idempotencyKey,
  });
};

/**
 * List saved payment methods (v4).
 */
export const listPaymentMethods = async ({ page = 1, size = 10 } = {}, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "GET",
    path: "/payment-methods",
    query: { page, size },
    traceId,
  });
};

/**
 * Retrieve a payment method by ID (v4).
 */
export const getPaymentMethod = async (paymentMethodId, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "GET",
    path: `/payment-methods/${paymentMethodId}`,
    traceId,
  });
};

/**
 * Build a v4 card payment-method payload with encrypted card fields.
 */
export const buildEncryptedCardPaymentMethod = ({
  cardNumber,
  expiryMonth,
  expiryYear,
  cvv,
  nonce = crypto.randomBytes(16).toString("hex"),
}) => ({
  type: "card",
  card: {
    encrypted_card_number: encryptFlutterwaveValue(cardNumber),
    encrypted_expiry_month: encryptFlutterwaveValue(expiryMonth),
    encrypted_expiry_year: encryptFlutterwaveValue(expiryYear),
    encrypted_cvv: encryptFlutterwaveValue(cvv),
    nonce,
  },
});

/**
 * Build a v4 mobile money payment-method payload (e.g. Uganda MTN/Airtel).
 */
export const buildMobileMoneyPaymentMethod = ({
  countryCode,
  network,
  phoneNumber,
}) => ({
  type: "mobile_money",
  mobile_money: {
    country_code: String(countryCode),
    network,
    phone_number: String(phoneNumber),
  },
});

// ---------------------------------------------------------------------------
// Payment intents / charges (Flutterwave v4)
// In v4, a "charge" is the closest equivalent to a payment intent.
// ---------------------------------------------------------------------------

/**
 * Create a payment intent (v4 charge).
 * Requires `customer_id`, `payment_method_id`, `amount`, `currency`, and unique `reference`.
 */
export const createPaymentIntent = async (payload, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId, idempotencyKey } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "POST",
    path: "/charges",
    body: {
      reference: payload.reference || generatePaymentReference("PAY"),
      ...payload,
    },
    traceId,
    idempotencyKey,
  });
};

/**
 * Retrieve a payment intent / charge by ID (v4).
 */
export const getPaymentIntent = async (chargeId, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "GET",
    path: `/charges/${chargeId}`,
    traceId,
  });
};

/**
 * Authorize or update a payment intent (PIN, AVS, OTP, etc.) — v4.
 */
export const authorizePaymentIntent = async (chargeId, payload, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId, idempotencyKey } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "PUT",
    path: `/charges/${chargeId}`,
    body: payload,
    traceId,
    idempotencyKey,
  });
};

/**
 * Hosted checkout session (v4) — alternative when you don't manage payment methods directly.
 */
export const createCheckoutSession = async (payload, options = {}) => {
  assertFlutterwaveV4Configured();

  const { traceId, idempotencyKey } = withV4Defaults(options);

  return flutterwaveV4Request({
    method: "POST",
    path: "/checkout/sessions",
    body: payload,
    traceId,
    idempotencyKey,
  });
};

// ---------------------------------------------------------------------------
// Standard checkout & transactions (Flutterwave v3)
// Works with FLUTTERWAVE_PUBLIC_KEY / FLUTTERWAVE_SECRET_KEY today.
// ---------------------------------------------------------------------------

/**
 * Initiate Flutterwave Standard checkout (v3 hosted payment page).
 * Returns a checkout link to redirect the customer.
 */
export const initiateStandardCheckout = async ({
  txRef,
  amount,
  currency = "UGX",
  redirectUrl,
  customer,
  customizations,
  paymentOptions,
  meta,
  subaccounts,
}) => {
  assertFlutterwaveConfigured();

  return flutterwaveV3Request({
    method: "POST",
    path: "payments",
    body: {
      tx_ref: txRef || generatePaymentReference("TX"),
      amount: String(amount),
      currency,
      redirect_url: redirectUrl || appConfig.clientUrl,
      customer,
      customizations,
      payment_options: paymentOptions,
      meta,
      subaccounts,
    },
  });
};

/**
 * Verify a transaction by Flutterwave transaction ID (v3).
 */
export const verifyTransaction = async (transactionId) =>
  callV3Sdk((client) => client.Transaction.verify({ id: String(transactionId) }));

/**
 * Verify a transaction by tx_ref (v3).
 */
export const verifyTransactionByReference = async (txRef) =>
  callV3Sdk((client) => client.Transaction.verify_by_tx({ tx_ref: txRef }));

/**
 * Fetch a transaction by ID (v3).
 */
export const getTransaction = async (transactionId) =>
  callV3Sdk((client) => client.Transaction.fetch({ id: String(transactionId) }));

/**
 * Initiate a refund (v3).
 */
export const refundTransaction = async ({ transactionId, amount }) =>
  callV3Sdk((client) =>
    client.Transaction.refund({
      id: String(transactionId),
      ...(amount !== undefined ? { amount: String(amount) } : {}),
    })
  );

/**
 * Calculate transaction fee before checkout (v3).
 */
export const getTransactionFee = async ({ amount, currency, type = "card" }) =>
  callV3Sdk((client) =>
    client.Transaction.fee({
      amount: String(amount),
      currency,
      type,
    })
  );

/**
 * Uganda mobile money collection (v3 direct charge).
 */
export const initiateUgandaMobileMoney = async ({
  txRef,
  amount,
  currency = "UGX",
  email,
  phoneNumber,
  network = "MTN",
  fullname,
  meta,
}) =>
  callV3Sdk((client) =>
    client.MobileMoney.uganda({
      tx_ref: txRef || generatePaymentReference("MM"),
      amount: String(amount),
      currency,
      email,
      phone_number: phoneNumber,
      network,
      fullname,
      meta,
    })
  );

// ---------------------------------------------------------------------------
// Marketplace splits & wallet (Flutterwave v3)
// ---------------------------------------------------------------------------

/**
 * Create a vendor subaccount for split payments (v3).
 */
export const createSubaccount = async (payload) =>
  callV3Sdk((client) => client.Subaccount.create(payload));

/**
 * Fetch subaccount details (v3).
 */
export const getSubaccount = async (subaccountId) =>
  callV3Sdk((client) => client.Subaccount.fetch({ id: String(subaccountId) }));

/**
 * List subaccounts (v3).
 */
export const listSubaccounts = async () =>
  callV3Sdk((client) => client.Subaccount.fetch_all({}));

/**
 * Get all wallet balances (v3).
 */
export const getWalletBalances = async () =>
  callV3Sdk((client) => client.Misc.bal());

/**
 * Resolve bank account details (v3) — useful for seller payout verification.
 */
export const resolveBankAccount = async ({ accountNumber, accountBank }) =>
  callV3Sdk((client) =>
    client.Misc.verify_Account({
      account_number: accountNumber,
      account_bank: accountBank,
    })
  );

// ---------------------------------------------------------------------------
// Capability probe — useful for health checks / startup logs
// ---------------------------------------------------------------------------

export const getFlutterwaveCapabilities = () => ({
  v3: isFlutterwaveV3Configured(),
  v4: isFlutterwaveV4Configured(),
  sandbox: appConfig.flutterwave.useSandbox,
});

import crypto from "crypto";
import flutterwave from "flutterwave-node-v3";
import { appConfig } from "../config/appConfig.js";
import {
  assertFlutterwaveConfigured,
  assertFlutterwaveV4Configured,
  FlutterwaveServiceError,
  unwrapFlutterwaveResponse,
} from "../utils/flutterwaveErrors.js";

const V3_BASE_URL = "https://api.flutterwave.com/v3/";
const V4_SANDBOX_URL = "https://developersandbox-api.flutterwave.com/";
const V4_PROD_URL = "https://f4bexperience.flutterwave.com/";
const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

let flutterwaveClient = null;
let cachedAccessToken = null;
let tokenExpiresAt = 0;

export const getFlutterwaveClient = () => {
  const { publicKey, secretKey } = appConfig.flutterwave;

  if (!publicKey || !secretKey) {
    return null;
  }

  if (!flutterwaveClient) {
    flutterwaveClient = new flutterwave(publicKey, secretKey);
  }

  return flutterwaveClient;
};

export const isFlutterwaveV3Configured = () =>
  Boolean(appConfig.flutterwave.publicKey && appConfig.flutterwave.secretKey);

export const isFlutterwaveV4Configured = () =>
  Boolean(appConfig.flutterwave.clientId && appConfig.flutterwave.clientSecret);

export const getFlutterwaveV4BaseUrl = () =>
  appConfig.flutterwave.useSandbox ? V4_SANDBOX_URL : V4_PROD_URL;

export const generateFlutterwaveTraceId = () => crypto.randomUUID();

export const generateFlutterwaveIdempotencyKey = () => crypto.randomUUID();

const buildQueryString = (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
};

const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new FlutterwaveServiceError("Invalid JSON response from Flutterwave.", {
      statusCode: 502,
      raw: text,
    });
  }
};

export const getFlutterwaveAccessToken = async ({ forceRefresh = false } = {}) => {
  assertFlutterwaveV4Configured();

  const now = Date.now();

  if (!forceRefresh && cachedAccessToken && tokenExpiresAt > now + 30_000) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    client_id: appConfig.flutterwave.clientId,
    client_secret: appConfig.flutterwave.clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok || !payload.access_token) {
    throw new FlutterwaveServiceError(
      payload.error_description || payload.error || "Failed to obtain Flutterwave access token.",
      { statusCode: 502, raw: payload }
    );
  }

  cachedAccessToken = payload.access_token;
  tokenExpiresAt = now + (payload.expires_in || 300) * 1000;

  return cachedAccessToken;
};

const resolveV3AuthHeaders = () => {
  assertFlutterwaveConfigured();

  return {
    Authorization: `Bearer ${appConfig.flutterwave.secretKey}`,
    "Content-Type": "application/json",
  };
};

const resolveV4AuthHeaders = async ({ idempotencyKey, traceId } = {}) => {
  const token = await getFlutterwaveAccessToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  if (traceId) {
    headers["X-Trace-Id"] = traceId;
  }

  return headers;
};

export const flutterwaveV3Request = async ({
  method = "POST",
  path,
  body,
  query,
}) => {
  const normalizedPath = path.replace(/^\//, "");
  const url = `${V3_BASE_URL}${normalizedPath}${buildQueryString(query)}`;

  const response = await fetch(url, {
    method,
    headers: resolveV3AuthHeaders(),
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });

  const payload = await parseJsonResponse(response);

  return unwrapFlutterwaveResponse({ body: payload, httpStatus: response.status });
};

export const flutterwaveV4Request = async ({
  method = "GET",
  path,
  body,
  query,
  idempotencyKey,
  traceId,
}) => {
  const normalizedPath = path.replace(/^\//, "");
  const url = `${getFlutterwaveV4BaseUrl()}${normalizedPath}${buildQueryString(query)}`;

  const response = await fetch(url, {
    method,
    headers: await resolveV4AuthHeaders({ idempotencyKey, traceId }),
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });

  const payload = await parseJsonResponse(response);

  return unwrapFlutterwaveResponse({ body: payload, httpStatus: response.status });
};

/**
 * Encrypt sensitive card fields for Flutterwave direct charge flows.
 * Requires FLUTTERWAVE_ENCRYPTION_KEY for v3-style 3DES encryption.
 */
export const encryptFlutterwaveValue = (value) => {
  const client = getFlutterwaveClient();
  const encryptionKey = appConfig.flutterwave.encryptionKey;

  if (!client || !encryptionKey) {
    throw new FlutterwaveServiceError(
      "Card encryption requires FLUTTERWAVE_PUBLIC_KEY, FLUTTERWAVE_SECRET_KEY, and FLUTTERWAVE_ENCRYPTION_KEY.",
      { statusCode: 503 }
    );
  }

  return client.security.encrypt(encryptionKey, String(value));
};

import { appConfig } from "../config/appConfig.js";

export class FlutterwaveServiceError extends Error {
  constructor(message, { statusCode = 502, code, validationErrors, raw } = {}) {
    super(message);
    this.name = "FlutterwaveServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.validationErrors = validationErrors;
    this.raw = raw;
  }
}

const mapHttpStatus = (httpStatus, body) => {
  if (httpStatus === 401 || httpStatus === 403) return 502;
  if (httpStatus >= 400 && httpStatus < 500) return 400;
  return 502;
};

export const unwrapFlutterwaveResponse = ({ body, httpStatus }) => {
  if (body?.status === "success") {
    return body.data ?? body;
  }

  const message =
    body?.error?.message ||
    body?.message ||
    "Flutterwave request failed.";

  throw new FlutterwaveServiceError(message, {
    statusCode: mapHttpStatus(httpStatus, body),
    code: body?.error?.code || body?.code,
    validationErrors: body?.error?.validation_errors,
    raw: body,
  });
};

export const assertFlutterwaveConfigured = () => {
  const { publicKey, secretKey } = appConfig.flutterwave;

  if (publicKey && secretKey) {
    return;
  }

  throw new FlutterwaveServiceError(
    "Flutterwave v3 is not configured. Set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY.",
    { statusCode: 503 }
  );
};

export const assertFlutterwaveV4Configured = () => {
  const { clientId, clientSecret } = appConfig.flutterwave;

  if (clientId && clientSecret) {
    return;
  }

  throw new FlutterwaveServiceError(
    "Flutterwave v4 is not configured. Set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET.",
    { statusCode: 503 }
  );
};

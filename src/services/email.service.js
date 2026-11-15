import { appConfig } from "../config/index.js";
import { getResendClient } from "../vendor/resend.vendor.js";
import {
  renderSellerEmail,
  renderInventoryEmail,
  renderOrderEmail,
  renderPaymentEmail,
  renderCancellationEmail,
  buildFromHeader,
  SELLER_EVENT_META,
  INVENTORY_EVENT_META,
  ORDER_EVENT_META,
  PAYMENT_EVENT_META,
  CANCELLATION_EVENT_META,
} from "../emails/index.js";

const SELLER_OTP_SUBJECT = "Your NileCart seller verification code";
const CUSTOMER_OTP_SUBJECT = "Your NileCart login code";
const DASHBOARD_OTP_SUBJECT = "Your NileCart dashboard login code";
const PASSWORD_RESET_OTP_SUBJECT = "Your NileCart password reset code";

const buildSellerOtpHtml = (otp) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Verify your email</h2>
    <p>Use this code to complete your seller account registration:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
    <p style="color: #666;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  </div>
`;

const buildCustomerOtpHtml = (otp) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Sign in to NileCart</h2>
    <p>Use this verification code to continue:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
    <p style="color: #666;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  </div>
`;

const buildDashboardOtpHtml = (otp) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Sign in to NileCart Dashboard</h2>
    <p>Use this verification code to continue:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
    <p style="color: #666;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  </div>
`;

const buildPasswordResetOtpHtml = (otp) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Reset your password</h2>
    <p>Use this verification code to reset your NileCart password:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
    <p style="color: #666;">This code expires in 10 minutes. If you did not request this password reset, please secure your account immediately or ignore this email.</p>
  </div>
`;

/**
 * Low-level Resend send with production-safe error handling.
 * @returns {{ sent: boolean, id?: string, skipped?: boolean }}
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  tags,
} = {}) => {
  if (!to) {
    const err = new Error("Email recipient is required");
    err.statusCode = 400;
    throw err;
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to];
  if (!recipients.length) {
    const err = new Error("Email recipient is required");
    err.statusCode = 400;
    throw err;
  }

  const resend = getResendClient();
  const fromAddress =
    from ||
    appConfig.email?.defaultFrom ||
    appConfig.resend.fromEmail;

  if (process.env.NODE_ENV === "test") {
    return { sent: true, id: "test-email-id", skipped: true };
  }

  if (resend && fromAddress) {
    const payload = {
      from: fromAddress,
      to: recipients,
      subject,
      html,
    };
    if (text) payload.text = text;
    if (replyTo) payload.replyTo = replyTo;
    if (tags?.length) payload.tags = tags;

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      const err = new Error(error.message || "Failed to send email.");
      err.statusCode = 502;
      throw err;
    }

    return { sent: true, id: data?.id };
  }

  if (appConfig.isDevelopment) {
    console.log(
      `[dev] Email skipped (Resend not configured)\n  to: ${recipients.join(", ")}\n  subject: ${subject}\n  from: ${fromAddress || "(unset)"}`
    );
    return { sent: false, skipped: true };
  }

  const err = new Error(
    "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL (or EMAIL_FROM_*)."
  );
  err.statusCode = 503;
  throw err;
};

const sendOtpEmail = async (email, otp, { subject, buildHtml, devLabel }) => {
  const resend = getResendClient();
  const accountsFrom = appConfig.email?.from?.accounts
    ? buildFromHeader("accounts", {
        emailDomain: appConfig.email.domain,
        fromOverrides: appConfig.email.from,
      })
    : appConfig.resend.fromEmail;

  if (resend && accountsFrom) {
    await sendEmail({
      to: email,
      subject,
      html: buildHtml(otp),
      from: accountsFrom,
      tags: [{ name: "category", value: "otp" }],
    });
    return;
  }

  if (appConfig.isDevelopment) {
    console.log(`[dev] ${devLabel} OTP for ${email}: ${otp}`);
    return;
  }

  const err = new Error(
    "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
  );
  err.statusCode = 503;
  throw err;
};

export const sendSellerVerificationOtp = async (email, otp) =>
  sendOtpEmail(email, otp, {
    subject: SELLER_OTP_SUBJECT,
    buildHtml: buildSellerOtpHtml,
    devLabel: "Seller",
  });

export const sendCustomerLoginOtp = async (email, otp) =>
  sendOtpEmail(email, otp, {
    subject: CUSTOMER_OTP_SUBJECT,
    buildHtml: buildCustomerOtpHtml,
    devLabel: "Customer login",
  });

export const sendDashboardLoginOtp = async (email, otp) =>
  sendOtpEmail(email, otp, {
    subject: DASHBOARD_OTP_SUBJECT,
    buildHtml: buildDashboardOtpHtml,
    devLabel: "Dashboard login",
  });

export const sendPasswordResetOtp = async (email, otp) =>
  sendOtpEmail(email, otp, {
    subject: PASSWORD_RESET_OTP_SUBJECT,
    buildHtml: buildPasswordResetOtpHtml,
    devLabel: "Password reset",
  });

/**
 * Send a rendered seller lifecycle email (B1–B9).
 * Non-critical path: callers may soft-fail so core workflows still succeed.
 */
export const sendSellerLifecycleEmail = async (eventKey, { to, data } = {}) => {
  if (!SELLER_EVENT_META[eventKey]) {
    throw new Error(`Unknown seller lifecycle event: ${eventKey}`);
  }

  const rendered = renderSellerEmail(eventKey, data || {});
  let from = buildFromHeader(rendered.senderKey, {
    emailDomain: appConfig.email?.domain,
    fromOverrides: appConfig.email?.from,
  });

  // Resend requires a verified sender; fall back to RESEND_FROM_EMAIL in early setup
  if (!appConfig.email?.from?.[rendered.senderKey] && appConfig.resend.fromEmail) {
    // Keep display name intent when only a raw fallback address is configured
    const fallback = appConfig.resend.fromEmail;
    from = fallback.includes("<")
      ? fallback
      : from.replace(/<[^>]+>/, `<${fallback}>`);
  }

  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from,
    replyTo: rendered.replyTo,
    tags: [
      { name: "category", value: "seller_lifecycle" },
      { name: "event", value: rendered.id },
    ],
  });
};

/**
 * Send a rendered inventory alert email (C4–C5).
 */
export const sendInventoryEmail = async (eventKey, { to, data } = {}) => {
  if (!INVENTORY_EVENT_META[eventKey]) {
    throw new Error(`Unknown inventory email event: ${eventKey}`);
  }

  const rendered = renderInventoryEmail(eventKey, data || {});
  let from = buildFromHeader(rendered.senderKey, {
    emailDomain: appConfig.email?.domain,
    fromOverrides: appConfig.email?.from,
  });

  if (!appConfig.email?.from?.[rendered.senderKey] && appConfig.resend.fromEmail) {
    const fallback = appConfig.resend.fromEmail;
    from = fallback.includes("<")
      ? fallback
      : from.replace(/<[^>]+>/, `<${fallback}>`);
  }

  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from,
    replyTo: rendered.replyTo,
    tags: [
      { name: "category", value: "inventory" },
      { name: "event", value: rendered.id },
    ],
  });
};

/**
 * Send a rendered order placement/status email.
 */
export const sendOrderEmail = async (eventKey, { to, data } = {}) => {
  if (!ORDER_EVENT_META[eventKey]) {
    throw new Error(`Unknown order email event: ${eventKey}`);
  }

  const rendered = renderOrderEmail(eventKey, data || {});
  let from = buildFromHeader(rendered.senderKey, {
    emailDomain: appConfig.email?.domain,
    fromOverrides: appConfig.email?.from,
  });

  if (!appConfig.email?.from?.[rendered.senderKey] && appConfig.resend.fromEmail) {
    const fallback = appConfig.resend.fromEmail;
    from = fallback.includes("<")
      ? fallback
      : from.replace(/<[^>]+>/, `<${fallback}>`);
  }

  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from,
    replyTo: rendered.replyTo,
    tags: [
      { name: "category", value: "orders" },
      { name: "event", value: rendered.id },
    ],
  });
};

/**
 * Send a rendered payment email (F1–F11).
 */
export const sendPaymentEmail = async (eventKey, { to, data } = {}) => {
  if (!PAYMENT_EVENT_META[eventKey]) {
    throw new Error(`Unknown payment email event: ${eventKey}`);
  }

  const rendered = renderPaymentEmail(eventKey, data || {});
  let from = buildFromHeader(rendered.senderKey, {
    emailDomain: appConfig.email?.domain,
    fromOverrides: appConfig.email?.from,
  });

  if (!appConfig.email?.from?.[rendered.senderKey] && appConfig.resend.fromEmail) {
    const fallback = appConfig.resend.fromEmail;
    from = fallback.includes("<")
      ? fallback
      : from.replace(/<[^>]+>/, `<${fallback}>`);
  }

  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from,
    replyTo: rendered.replyTo,
    tags: [
      { name: "category", value: "payments" },
      { name: "event", value: rendered.id },
    ],
  });
};

/**
 * Send a rendered cancellation email (G1–G6).
 */
export const sendCancellationEmail = async (eventKey, { to, data } = {}) => {
  if (!CANCELLATION_EVENT_META[eventKey]) {
    throw new Error(`Unknown cancellation email event: ${eventKey}`);
  }

  const rendered = renderCancellationEmail(eventKey, data || {});
  let from = buildFromHeader(rendered.senderKey, {
    emailDomain: appConfig.email?.domain,
    fromOverrides: appConfig.email?.from,
  });

  if (!appConfig.email?.from?.[rendered.senderKey] && appConfig.resend.fromEmail) {
    const fallback = appConfig.resend.fromEmail;
    from = fallback.includes("<")
      ? fallback
      : from.replace(/<[^>]+>/, `<${fallback}>`);
  }

  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from,
    replyTo: rendered.replyTo,
    tags: [
      { name: "category", value: "cancellations" },
      { name: "event", value: rendered.id },
    ],
  });
};

import { getResendClient } from "../vendor/resend.vendor.js";
import { getNodemailerTransport } from "../vendor/nodemailer.vendor.js";

const OTP_SUBJECT = "Your LightCollection seller verification code";

const buildOtpHtml = (otp) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Verify your email</h2>
    <p>Use this code to complete your seller account registration:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
    <p style="color: #666;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  </div>
`;

const sendViaNodemailer = async (email, otp) => {
  const transport = getNodemailerTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transport.sendMail({
    from,
    to: email,
    subject: OTP_SUBJECT,
    html: buildOtpHtml(otp),
  });
};

const sendViaResend = async (email, otp) => {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: OTP_SUBJECT,
    html: buildOtpHtml(otp),
  });

  if (error) {
    const err = new Error(error.message || "Failed to send verification email.");
    err.statusCode = 502;
    throw err;
  }
};

export const sendSellerVerificationOtp = async (email, otp) => {
  if (getNodemailerTransport()) {
    await sendViaNodemailer(email, otp);
    return;
  }

  // const resend = getResendClient();
  // const from = process.env.RESEND_FROM_EMAIL;

  // if (resend && from) {
  //   await sendViaResend(email, otp);
  //   return;
  // }

  if (process.env.NODE_ENV === "development") {
    console.log(`[dev] Seller OTP for ${email}: ${otp}`);
    return;
  }

  const err = new Error(
    "Email service is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (or RESEND_API_KEY and RESEND_FROM_EMAIL)."
  );
  err.statusCode = 503;
  throw err;
};

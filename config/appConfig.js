import "dotenv/config";

const trim = (value) => value?.trim() || undefined;

export const appConfig = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: (process.env.NODE_ENV || "development") === "development",

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  mongodb: {
    uri: trim(process.env.MONGODB_URI),
  },

  jwt: {
    secret: trim(process.env.JWT_SECRET),
  },

//   MTP_HOST=smtp.gmail.com
// SMTP_PORT=587
// SMTP_SECURE=false
// SMTP_USER=rahulkumarkudra2004@gmail.com
// SMTP_PASS=ynpm haje zvkb jyrg
// SMTP_FROM="NileCart <rahulkumarkudra2004@gmail.com>"
  smtp: {
    host: trim(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: trim(process.env.SMTP_USER),
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  },

  resend: {
    apiKey: trim(process.env.RESEND_API_KEY),
    fromEmail: trim(process.env.RESEND_FROM_EMAIL),
  },

  firebase: {
    serviceAccountPath: trim(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
    serviceAccount: trim(process.env.FIREBASE_SERVICE_ACCOUNT),
  },

  admin: {
    email: trim(process.env.ADMIN_EMAIL),
    password: trim(process.env.ADMIN_PASSWORD),
    name: trim(process.env.ADMIN_NAME) || "Platform Admin",
  },
  aws: {
    accessKeyId: trim(process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: trim(process.env.AWS_SECRET_ACCESS_KEY),
    region: trim(process.env.AWS_REGION),
    bucketName: trim(process.env.AWS_BUCKET_NAME),
    /** Optional CloudFront or custom CDN origin, e.g. https://cdn.example.com */
    publicUrlBase: trim(process.env.AWS_S3_PUBLIC_URL),
  },
  orderNumberPrefix: trim(process.env.ORDER_NUMBER_PREFIX),
  flutterwave: {
    publicKey: trim(process.env.FLUTTERWAVE_PUBLIC_KEY),
    secretKey: trim(process.env.FLUTTERWAVE_SECRET_KEY),
    encryptionKey: trim(process.env.FLUTTERWAVE_ENCRYPTION_KEY),
  },
};

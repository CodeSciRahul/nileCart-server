import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { appConfig } from "../config/appConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let initialized = false;

export const initFirebaseAdmin = () => {
  if (initialized) return admin;

  const { serviceAccountPath, serviceAccount: serviceAccountJson } = appConfig.firebase;

  if (serviceAccountJson) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
    });
  } else if (serviceAccountPath) {
    const absolutePath = join(process.cwd(), serviceAccountPath);
    const serviceAccount = JSON.parse(readFileSync(absolutePath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.warn(
      "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH for auth APIs."
    );
  }

  initialized = true;
  return admin;
};

export default admin;

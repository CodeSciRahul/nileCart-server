import { Resend } from "resend";
import { appConfig } from "../config/appConfig.js";

let resendClient = null;

export const getResendClient = () => {
  if (!appConfig.resend.apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(appConfig.resend.apiKey);
  }

  return resendClient;
};

import nodemailer from "nodemailer";
import { appConfig } from "../config/appConfig.js";

let transport = null;

export const getNodemailerTransport = () => {
  const { host, user, pass, port, secure } = appConfig.smtp;

  if (!host || !user || !pass) {
    return null;
  }

  if (!transport) {
    transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  return transport;
};

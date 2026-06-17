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
      // Some hosts (common on VPS) don't have IPv6 egress; Gmail often resolves to IPv6 first.
      // For SMTP, prefer IPv4 to avoid ENETUNREACH to 2607:f8b0:*.
      family: 4,
      auth: { user, pass },
    });
    console.log("Nodemailer transport created successfully")
  }

  return transport;
};

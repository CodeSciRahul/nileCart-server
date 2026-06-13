import nodemailer from "nodemailer";
import { appConfig } from "../config/appConfig.js";

let transport = null;

export const getNodemailerTransport = () => {
  const { host, user, pass, port, secure } = appConfig.smtp;

  if (!host || !user || !pass) {
    return null;
  }

  if (!transport) {
    try {
    transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      });
    } catch (error) {
      console.log("Error creating nodemailer transport", error)
      throw error;
    } 
  }

  return transport;
};

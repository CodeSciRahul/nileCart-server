import { appConfig } from "../config/appConfig.js";
export const generateOrderNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${appConfig.orderNumberPrefix}-${ts}-${rand}`;
};

export const FREE_SHIPPING_THRESHOLD = 999;

export const calculateShippingFee = (subtotalAfterDiscount) =>
  subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : 79;

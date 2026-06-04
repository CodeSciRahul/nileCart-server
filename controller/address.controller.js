import Address from "../models/Address.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id }).sort("-isDefault");
  sendSuccess(res, { addresses });
});

export const createAddress = asyncHandler(async (req, res) => {
  const data = { ...req.body, user: req.user._id };

  if (data.isDefault) {
    await Address.updateMany({ user: req.user._id }, { isDefault: false });
  }

  const addressCount = await Address.countDocuments({ user: req.user._id });
  if (addressCount === 0) data.isDefault = true;

  const address = await Address.create(data);
  sendSuccess(res, { address }, 201);
});

export const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) return sendError(res, "Address not found", 404);

  if (req.body.isDefault) {
    await Address.updateMany({ user: req.user._id }, { isDefault: false });
  }

  Object.assign(address, req.body);
  await address.save();
  sendSuccess(res, { address });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) return sendError(res, "Address not found", 404);
  sendSuccess(res, { message: "Address deleted" });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  await Address.updateMany({ user: req.user._id }, { isDefault: false });
  const address = await Address.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isDefault: true },
    { new: true }
  );

  if (!address) return sendError(res, "Address not found", 404);
  sendSuccess(res, { address });
});

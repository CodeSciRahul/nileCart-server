import User from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const listUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const filter = {};
  if (role) filter.role = role;

  const users = await User.find(filter)
    .select("name email mobileNumber role isActive createdAt")
    .sort("-createdAt");

  sendSuccess(res, { users });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return sendError(res, "User not found", 404);
  }

  if (user.role === "admin") {
    return sendError(res, "Cannot modify admin account status", 403);
  }

  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    return sendError(res, "isActive must be a boolean");
  }

  user.isActive = isActive;
  await user.save();

  sendSuccess(res, { user, message: `User ${isActive ? "activated" : "deactivated"}` });
});

import User from "../models/User.js";

export { User };

export const find = (filter, options) => User.find(filter, null, options);
export const findOne = (filter) => User.findOne(filter);
export const findById = (id, select) => User.findById(id).select(select);
export const create = (data) => User.create(data);
export const countDocuments = (filter) => User.countDocuments(filter);
export const findByIdAndUpdate = (id, update, options) =>
  User.findByIdAndUpdate(id, update, options);

export const findByFirebaseUid = (firebaseUid) => User.findOne({ firebaseUid });

export const findByEmail = (email) =>
  User.findOne({ email: email?.toLowerCase() });

export const findByEmailWithPassword = (email) =>
  User.findOne({ email: email?.toLowerCase() }).select("+passwordHash");

export const findByIdWithPassword = (id) =>
  User.findById(id).select("+passwordHash");

export const findByEmailOrMobile = (email, mobileNumber) => {
  const or = [];
  if (email) or.push({ email: email.toLowerCase() });
  if (mobileNumber) or.push({ mobileNumber });
  return or.length ? User.findOne({ $or: or }) : null;
};

export const findAllSorted = (filter = {}) =>
  User.find(filter).sort("-createdAt").select("-__v");

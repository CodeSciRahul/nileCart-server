const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export { slugify };

export const formatUserProfile = (user, seller = null) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  mobileNumber: user.mobileNumber,
  gender: user.gender,
  birthday: user.birthday,
  avatar: user.avatar,
  categoryPreferences: user.categoryPreferences,
  role: user.role,
  isActive: user.isActive,
  isVerified: user.isVerified,
  seller: seller
    ? {
        _id: seller._id,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        approvalStatus: seller.approvalStatus,
        isVerified: seller.isVerified,
        isActive: seller.isActive,
        rejectionReason: seller.rejectionReason,
      }
    : null,
});

import Review from "../models/Review.model.js";
import Product from "../models/Product.model.js";
import Order from "../models/Order.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import {
  getImageUrl,
  normalizeStoredImages,
  toPublicImageUrls,
} from "../utils/storedImageHelpers.js";

const refreshProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { product: productId, isApproved: true } },
    {
      $group: {
        _id: "$product",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const average = stats[0]?.average ? Math.round(stats[0].average * 10) / 10 : 0;
  const count = stats[0]?.count || 0;

  await Product.findByIdAndUpdate(productId, {
    rating: { average, count },
  });
};

export const getProductReviews = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const filter = {
    product: req.params.productId,
    isApproved: true,
  };

  const reviews = await Review.find(filter)
    .populate("user", "name avatar")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments(filter);

  sendSuccess(res, {
    reviews: reviews.map((review) => {
      const obj = review.toObject();
      return {
        ...obj,
        images: toPublicImageUrls(obj.images),
        user: obj.user
          ? { ...obj.user, avatar: getImageUrl(obj.user.avatar) }
          : obj.user,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const createReview = asyncHandler(async (req, res) => {
  const { productId, rating, title, comment, orderId, images } = req.body;

  if (!productId || !rating) {
    return sendError(res, "productId and rating are required");
  }

  const product = await Product.findById(productId);
  if (!product) return sendError(res, "Product not found", 404);

  let isVerifiedPurchase = false;
  if (orderId) {
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      orderStatus: "delivered",
      "items.product": productId,
    });
    isVerifiedPurchase = !!order;
  }

  const review = await Review.create({
    user: req.user._id,
    product: productId,
    order: orderId,
    rating,
    title,
    comment,
    images: normalizeStoredImages(images),
    isVerifiedPurchase,
  });

  await refreshProductRating(productId);
  sendSuccess(res, { review }, 201);
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!review) return sendError(res, "Review not found", 404);
  await refreshProductRating(review.product);
  sendSuccess(res, { message: "Review deleted" });
});

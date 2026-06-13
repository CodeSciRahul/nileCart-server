import { asyncHandler } from "../utils/asyncHandler.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import {
  createPresignedUploadUrl,
  deleteStoredImage,
} from "../service/upload.service.js";
import { UPLOAD_FOLDERS } from "../utils/uploadHelpers.js";

/**
 * POST /api/uploads/presign
 * Body: { fileName, contentType, folder }
 *
 * Returns a presigned PUT URL for direct browser-to-S3 upload.
 */
export const createPresignedUrl = asyncHandler(async (req, res) => {
  const { fileName, contentType, folder = UPLOAD_FOLDERS.PRODUCTS, documentType } = req.body;

  if (!fileName?.trim()) {
    return sendError(res, "fileName is required.", 400);
  }

  if (!contentType?.trim()) {
    return sendError(res, "contentType is required.", 400);
  }

  const result = await createPresignedUploadUrl({
    fileName,
    contentType,
    folder,
    documentType,
    user: req.user,
    seller: req.seller,
  });

  sendSuccess(res, result);
});



/**
 * DELETE /api/uploads/delete
 * Body: { key }
 */
export const deleteImage = asyncHandler(async (req, res) => {
  const { key } = req.body;

  if (!key?.trim()) {
    return sendError(res, "key is required.", 400);
  }

  await deleteStoredImage({
    key,
    user: req.user,
    seller: req.seller,
  });

  sendSuccess(res, { message: "Image deleted successfully" });
});
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { appConfig } from "../config/appConfig.js";
import {
  getS3Client,
  getS3BucketName,
  getS3Region,
} from "../vendor/s3.vendor.js";
import {
  assertCanDeleteObjectKey,
  buildObjectKey,
  buildPublicFileUrl,
  isSellerScopedFolder,
  isValidUploadFolder,
  PRESIGN_EXPIRES_IN_SECONDS,
  UPLOAD_FOLDERS,
  validateImageUpload,
} from "../utils/uploadHelpers.js";

const assertS3Configured = () => {
  const client = getS3Client();
  const bucketName = getS3BucketName();
  const region = getS3Region();

  if (!client || !bucketName || !region) {
    const err = new Error(
      "File upload is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_BUCKET_NAME."
    );
    err.statusCode = 503;
    throw err;
  }

  return { client, bucketName, region };
};

const resolveUploadContext = ({ folder, user, seller }) => {
  if (!isValidUploadFolder(folder)) {
    const err = new Error("Invalid upload folder.");
    err.statusCode = 400;
    throw err;
  }

  if (folder === UPLOAD_FOLDERS.PLATFORM_BANNERS) {
    if (user.role !== "admin") {
      const err = new Error("Only admins can upload platform banners.");
      err.statusCode = 403;
      throw err;
    }

    return { userId: user._id.toString(), sellerId: null };
  }

  if (folder === UPLOAD_FOLDERS.PROFILES) {
    return { userId: user._id.toString(), sellerId: null };
  }

  if (folder === UPLOAD_FOLDERS.CATEGORIES) {
    if (user.role !== "admin") {
      const err = new Error("Only admins can upload category images.");
      err.statusCode = 403;
      throw err;
    }

    return { userId: user._id.toString(), sellerId: null };
  }

  if (isSellerScopedFolder(folder)) {
    if (user.role === "admin") {
      return {
        userId: user._id.toString(),
        sellerId: seller?._id?.toString() || "admin",
      };
    }

    if (user.role !== "seller") {
      const err = new Error("Seller account required for this upload type.");
      err.statusCode = 403;
      throw err;
    }

    if (folder === UPLOAD_FOLDERS.PRODUCTS) {
      if (!seller || seller.approvalStatus !== "Approved") {
        const err = new Error("Approved seller account required to upload product images.");
        err.statusCode = 403;
        throw err;
      }

      return {
        userId: user._id.toString(),
        sellerId: seller._id.toString(),
      };
    }

    // Store logos/banners work during onboarding before a seller profile exists.
    return {
      userId: user._id.toString(),
      sellerId: seller?._id?.toString() || user._id.toString(),
    };
  }

  const err = new Error("Unsupported upload folder.");
  err.statusCode = 400;
  throw err;
};

/**
 * Generates a short-lived presigned PUT URL so the client uploads directly to S3.
 * The server never receives the file bytes.
 */
export const createPresignedUploadUrl = async ({
  fileName,
  contentType,
  folder,
  user,
  seller,
}) => {
  const validation = validateImageUpload({ contentType, fileName });

  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = 400;
    throw err;
  }

  const { userId, sellerId } = resolveUploadContext({ folder, user, seller });
  const key = buildObjectKey({
    folder,
    extension: validation.extension,
    userId,
    sellerId,
  });

  if (!key) {
    const err = new Error("Unable to build storage key for this upload.");
    err.statusCode = 400;
    throw err;
  }

  const { client, bucketName, region } = assertS3Configured();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: validation.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
    // Browser PUT always sends Content-Type for File uploads — it must be signed.
    signableHeaders: new Set(["content-type"]),
  });

  // it is the public url for the file to be accessed by the client
  const fileUrl = buildPublicFileUrl({
    key,
    bucketName,
    region,
    publicUrlBase: appConfig.aws.publicUrlBase,
  });

  return {
    uploadUrl,
    fileUrl,
    key,
    expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
  };
};


/**
 * Deletes an object from S3 after verifying the caller owns that key prefix.
 */
export const deleteStoredImage = async ({ key, user, seller }) => {
  const trimmedKey = key?.trim();

  if (!trimmedKey) {
    const err = new Error("key is required.");
    err.statusCode = 400;
    throw err;
  }

  assertCanDeleteObjectKey({ key: trimmedKey, user, seller });

  const { client, bucketName } = assertS3Configured();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: trimmedKey,
    })
  );

  return { key: trimmedKey };
};

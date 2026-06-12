import { S3Client } from "@aws-sdk/client-s3";
import { appConfig } from "../config/appConfig.js";

let s3Client = null;

export const getS3Client = () => {
  const { accessKeyId, secretAccessKey, region, bucketName } = appConfig.aws;

  if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // SDK v3 defaults add CRC32 checksums to presigned PUT URLs. Browsers cannot
      // send matching checksum headers, which causes S3 to return 403 Forbidden.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return s3Client;
};

export const getS3BucketName = () => appConfig.aws.bucketName;

export const getS3Region = () => appConfig.aws.region;

/**
 * Run: node scripts/verifyS3Access.js
 * Tests whether the IAM user in .env can PutObject to the configured bucket.
 */
import "dotenv/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error("Missing AWS env vars. Set AWS_REGION, AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.");
  process.exit(1);
}

console.log("Bucket:", bucket);
console.log("Region:", region);
console.log("Access key:", `${accessKeyId.slice(0, 8)}...`);
console.log();

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const key = `products/verify-${Date.now()}.txt`;

try {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: "s3 access verify",
      ContentType: "text/plain",
    })
  );
  console.log("Direct PutObject: SUCCESS");
} catch (err) {
  console.log("Direct PutObject: FAILED");
  console.log(err.message);
}

const uploadUrl = await getSignedUrl(
  s3,
  new PutObjectCommand({
    Bucket: bucket,
    Key: `${key}-presign`,
    ContentType: "text/plain",
  }),
  { expiresIn: 300, signableHeaders: new Set(["content-type"]) }
);

const res = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": "text/plain" },
  body: "presign verify",
});

const xml = await res.text();
const code = xml.match(/<Code>([^<]+)<\/Code>/)?.[1];
const message = xml.match(/<Message>([^<]+)<\/Message>/)?.[1];

console.log(`Presigned PUT: ${res.status}${code ? ` (${code})` : ""}`);
if (message) console.log(message);

if (code === "AccessDenied") {
  console.log();
  console.log("Fix: IAM → Users → open the user shown in the error above → Permissions tab");
  console.log("     → attach an inline or managed policy with s3:PutObject on arn:aws:s3:::BUCKET/*");
}

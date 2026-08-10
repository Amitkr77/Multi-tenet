import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * A minimal, direct S3/MinIO client for apps/worker — deliberately NOT a
 * shared/refactored copy of apps/api's `StorageService` (that class lives in
 * apps/api only, and this is its one worker-side caller). Same env vars,
 * same MinIO-in-dev/S3-in-prod story (`STORAGE_ENDPOINT`/`STORAGE_BUCKET`/
 * etc.) — mirrors `createBasePrismaClient()`'s own precedent exactly: a
 * worker process gets its own small, direct dependency (no DI, no
 * cross-app import) rather than a shared-package extraction for one caller.
 */
const client = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
  region: process.env.STORAGE_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "minioadmin",
  },
});

const bucket = process.env.STORAGE_BUCKET ?? "saas-dev";

export async function putObject(
  key: string,
  body: string,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Time-limited signed GET URL — same reasoning as apps/api's identically-named method (never the public, unexpiring URL for anything that can contain PII). */
export async function getPresignedDownloadUrl(
  key: string,
  expirySeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expirySeconds });
}

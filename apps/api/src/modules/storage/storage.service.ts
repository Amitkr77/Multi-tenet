import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';

/**
 * Wraps an S3-compatible client — MinIO in dev (docker-compose.yml's
 * `minio` service, bucket `saas-dev`, already public-read via
 * `mc anonymous set download`), real S3 in production (arch.md: "AWS S3 (or
 * MinIO in development)"). Presigned-URL-direct-to-storage, not proxied
 * through Nest — the browser PUTs the file straight to `uploadUrl`; the API
 * never sees the file bytes.
 */
@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    forcePathStyle: true, // required for MinIO (and any non-AWS S3-compatible endpoint)
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'minioadmin',
    },
  });

  private readonly bucket = process.env.STORAGE_BUCKET ?? 'saas-dev';
  private readonly publicUrlBase =
    process.env.STORAGE_PUBLIC_URL_BASE ?? 'http://localhost:9000/saas-dev';

  /** Namespaced by tenant/product purely for logical organization in the bucket — not an access-control boundary (see the file's own note on that). */
  buildKey(tenantId: string, productId: string, filename: string): string {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `tenants/${tenantId}/products/${productId}/${randomBytes(8).toString('hex')}-${safeName}`;
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 300 }); // 5 minutes to complete the upload
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrlBase}/${key}`;
  }

  /**
   * A time-limited, signed GET URL — unlike `getPublicUrl` (unexpiring,
   * relies entirely on the bucket's own public-read policy), this is the
   * correct choice for anything that shouldn't be world-readable by
   * key-guessing (e.g. a compliance data export, which can contain PII).
   * Mirrors `getPresignedUploadUrl`'s shape exactly, GET instead of PUT.
   */
  async getPresignedDownloadUrl(
    key: string,
    expirySeconds: number,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expirySeconds });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

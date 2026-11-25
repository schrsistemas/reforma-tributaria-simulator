import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ArtifactStorage } from "./capture.js";

export interface S3ArtifactStorageOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export class S3ArtifactStorage implements ArtifactStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3ArtifactStorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey
      }
    });
  }

  async putObject(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    metadata: Record<string, string>;
  }): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata,
      ServerSideEncryption: "AES256"
    }));
  }

  /**
   * Returns object metadata, null only when the key does not exist.
   * Authorization, network and provider errors are propagated to the caller.
   */
  async headObject(key: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      }));
      return result.Metadata ?? {};
    } catch (error) {
      const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (candidate.name === "NotFound" || candidate.name === "NoSuchKey" ||
          candidate.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    this.client.destroy();
  }
}

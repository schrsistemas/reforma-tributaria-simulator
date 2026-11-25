import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

  async close(): Promise<void> {
    this.client.destroy();
  }
}

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/** Thin wrapper over the S3 API (local container in dev, Cloudflare R2 in prod). */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  private readonly s3: S3Client;
  readonly media: string;
  readonly widgets: string;
  private readonly publicBase: Record<string, string>;

  constructor(config: ConfigService<Env, true>) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : config.get('S3_ENDPOINT', { infer: true }),
      forcePathStyle: !accountId,
      credentials: {
        accessKeyId: config.get('R2_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true }),
      },
    });
    this.media = config.get('R2_BUCKET_MEDIA', { infer: true });
    this.widgets = config.get('R2_BUCKET_WIDGETS', { infer: true });
    this.publicBase = {
      [this.media]: config.get('R2_PUBLIC_MEDIA_URL', { infer: true }),
      [this.widgets]: config.get('R2_PUBLIC_WIDGETS_URL', { infer: true }),
    };
  }

  /**
   * Dev convenience: create the public buckets with a read-only anonymous policy. Never fatal, because the API must
   * boot without storage (only uploads fail). In prod buckets are provisioned by hand and the policy call is skipped
   * by R2 (public access is a bucket setting there), so errors here are only logged.
   */
  async onModuleInit() {
    for (const bucket of [this.media, this.widgets]) {
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (e) {
          this.log.warn(
            `Cannot create bucket ${bucket}: ${(e as Error).message}`,
          );
          continue;
        }
      }
      try {
        await this.s3.send(
          new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: '*',
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${bucket}/*`],
                },
              ],
            }),
          }),
        );
      } catch {
        /* R2 manages public access outside the S3 API */
      }
    }
  }

  publicUrl(bucket: string, key: string) {
    return `${this.publicBase[bucket].replace(/\/$/, '')}/${key}`;
  }

  async put(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
    cacheControl = 'public, max-age=31536000, immutable',
  ) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  }

  async remove(bucket: string, key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async removeMany(bucket: string, keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
      );
    }
  }
}

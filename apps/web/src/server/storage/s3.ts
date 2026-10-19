import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

function getS3Client(): S3Client | null {
  if (
    !env.S3_COMPATIBLE_ACCESS_KEY ||
    !env.S3_COMPATIBLE_SECRET_KEY ||
    !env.S3_COMPATIBLE_API_URL ||
    !env.S3_COMPATIBLE_BUCKET
  ) {
    return null;
  }

  return new S3Client({
    endpoint: env.S3_COMPATIBLE_API_URL,
    region: env.S3_COMPATIBLE_REGION,
    credentials: {
      accessKeyId: env.S3_COMPATIBLE_ACCESS_KEY,
      secretAccessKey: env.S3_COMPATIBLE_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

export function isStorageConfigured(): boolean {
  return getS3Client() !== null;
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getS3Client();
  if (!client) {
    throw new Error("Object storage is not configured");
  }

  const bucket = env.S3_COMPATIBLE_BUCKET!;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const base = env.S3_COMPATIBLE_PUBLIC_URL ?? env.S3_COMPATIBLE_API_URL!;
  const publicUrl = `${base.replace(/\/$/, "")}/${bucket}/${key}`;

  return { uploadUrl, publicUrl };
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  if (!client) return;

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_COMPATIBLE_BUCKET!,
      Key: key,
    }),
  );
}

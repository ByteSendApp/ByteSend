import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env";

interface InboundStore {
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

class S3Store implements InboundStore {
  private client: S3Client;

  constructor(
    private bucket: string,
    region: string,
  ) {
    this.client = new S3Client({
      region,
      credentials: { accessKeyId: env.AWS_ACCESS_KEY, secretAccessKey: env.AWS_SECRET_KEY },
    });
  }

  async get(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await response.Body!.transformToByteArray());
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async remove(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      if (batch.length === 0) continue;
      await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
    }
  }
}

class DiskStore implements InboundStore {
  constructor(private root: string) { }

  private path(key: string) {
    const target = normalize(join(this.root, key));
    if (!target.startsWith(normalize(this.root))) throw new Error("Invalid storage key");
    return target;
  }

  async get(key: string) {
    return readFile(this.path(key));
  }

  async put(key: string, body: Buffer) {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async remove(keys: string[]) {
    await Promise.all(keys.map((key) => rm(this.path(key), { force: true })));
  }
}

let store: InboundStore | null | undefined;

export function isInboundEnabled() {
  return Boolean(env.INBOUND_S3_BUCKET) || env.NODE_ENV === "development";
}

export function getInboundStore(): InboundStore {
  if (store) return store;
  if (env.INBOUND_S3_BUCKET) {
    store = new S3Store(env.INBOUND_S3_BUCKET, env.INBOUND_REGION);
  } else if (env.NODE_ENV === "development") {
    store = new DiskStore(join(process.cwd(), ".data", "inbound"));
  } else {
    throw new Error("Inbound email isn't configured: set INBOUND_S3_BUCKET");
  }
  return store;
}

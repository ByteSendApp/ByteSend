import IORedis from "ioredis";
import { env } from "~/env";

export let connection: IORedis | null = null;

export const REDIS_PREFIX = env.REDIS_KEY_PREFIX
  ? `${env.REDIS_KEY_PREFIX}:`
  : "";

export const BULL_PREFIX = env.REDIS_KEY_PREFIX || "bull";

export function redisKey(key: string): string {
  return `${REDIS_PREFIX}${key}`;
}

export const getRedis = () => {
  if (!connection || connection.status === "end") {
    connection = new IORedis(`${env.REDIS_URL}?family=0`, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
};

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlSeconds?: number; disable?: boolean },
): Promise<T> {
  const { ttlSeconds = 120, disable = false } = options ?? {};

  const redis = getRedis();
  const prefixedKey = redisKey(key);

  if (!disable) {
    const cached = await redis.get(prefixedKey);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch { }
    }
  }

  const value = await fetcher();

  if (!disable) {
    try {
      await redis.setex(prefixedKey, ttlSeconds, JSON.stringify(value));
    } catch { }
  }

  return value;
}

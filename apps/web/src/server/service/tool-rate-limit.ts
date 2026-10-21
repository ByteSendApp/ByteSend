import { logger } from "../logger/log";
import { getRedis, redisKey } from "../redis";

const LIMIT_PER_MINUTE = 20;

export function clientIp(request: Request) {
  const headers = request.headers;
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown";
}

export async function toolRateLimited(request: Request, tool: string) {
  try {
    const redis = getRedis();
    const key = redisKey(`rl:tools:${tool}:${clientIp(request)}`);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count > LIMIT_PER_MINUTE;
  } catch (error) {
    logger.warn({ err: error, tool }, "[Tools]: Rate limit unavailable");
    return false;
  }
}

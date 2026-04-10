import { Redis } from "@upstash/redis";

type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
};

let cachedRedisClient: Redis | null | undefined;

function getUpstashClient(): Redis | null {
  if (cachedRedisClient !== undefined) {
    return cachedRedisClient;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    cachedRedisClient = null;
    return null;
  }

  cachedRedisClient = new Redis({
    url: redisUrl,
    token: redisToken
  });
  return cachedRedisClient;
}

export async function consumeDistributedRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<DistributedRateLimitResult | null> {
  const redis = getUpstashClient();
  if (!redis) {
    return null;
  }

  const now = Date.now();
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  let ttlSec = await redis.ttl(key);
  if (ttlSec <= 0) {
    await redis.expire(key, windowSec);
    ttlSec = windowSec;
  }

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetAtMs: now + ttlSec * 1000
  };
}

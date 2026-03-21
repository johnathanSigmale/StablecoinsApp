import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<RedisClient | null> | null = null;

function getRedisUrl() {
  return process.env.STORAGE_URL || process.env.REDIS_URL || process.env.KV_URL || "";
}

export function hasRedisStore() {
  return Boolean(getRedisUrl());
}

async function getRedisClient() {
  if (!hasRedisStore()) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  redisConnectPromise = (async () => {
    try {
      const client = createClient({
        url: getRedisUrl(),
      }) as RedisClient;

      client.on("error", (error: unknown) => {
        console.error("Redis client error:", error);
      });

      await client.connect();
      redisClient = client;
      return client;
    } catch (error) {
      console.error("Redis connection failed:", error);
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

export async function readRedisJson<T>(key: string) {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  const raw = await client.get(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("Redis JSON parse failed:", error);
    return null;
  }
}

export async function writeRedisJson(key: string, value: unknown) {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  await client.set(key, JSON.stringify(value));
  return true;
}

export async function acquireRedisLock(key: string, ttlSeconds: number) {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  const result = await client.set(key, "1", {
    NX: true,
    EX: ttlSeconds,
  });

  return result === "OK";
}

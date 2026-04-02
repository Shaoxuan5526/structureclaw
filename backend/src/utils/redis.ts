import Redis from 'ioredis';
import { config } from '../config/index.js';

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry>();

const redisClient = config.redisUrl
  ? new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  : null;

if (redisClient) {
  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redisClient.on('error', (err) => {
    console.warn('⚠️ Redis unavailable, using in-memory cache fallback:', err.message);
  });
}

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySetex(key: string, ttlSeconds: number, value: string): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export const redis = {
  async get(key: string): Promise<string | null> {
    if (!redisClient) {
      return memoryGet(key);
    }

    try {
      return await redisClient.get(key);
    } catch {
      return memoryGet(key);
    }
  },

  async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    if (!redisClient) {
      memorySetex(key, ttlSeconds, value);
      return 'OK';
    }

    try {
      await redisClient.setex(key, ttlSeconds, value);
      return 'OK';
    } catch {
      memorySetex(key, ttlSeconds, value);
      return 'OK';
    }
  },

  async del(key: string): Promise<number> {
    memoryCache.delete(key);

    if (!redisClient) {
      return 1;
    }

    try {
      return await redisClient.del(key);
    } catch {
      return 1;
    }
  },

  async ping(): Promise<'PONG'> {
    if (!redisClient) {
      return 'PONG';
    }

    try {
      await redisClient.ping();
      return 'PONG';
    } catch {
      return 'PONG';
    }
  },

  async quit(): Promise<void> {
    if (!redisClient) {
      return;
    }

    try {
      await redisClient.quit();
    } catch {
      // Ignore shutdown errors from unavailable Redis.
    }
  },
};

import IORedis from 'ioredis';
import { logger } from './logger';

const {
  REDIS_HOST = 'localhost',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = '',
  REDIS_TLS = 'false',
} = process.env;

const redisConfig = {
  host: REDIS_HOST,
  port: parseInt(REDIS_PORT, 10),
  password: REDIS_PASSWORD || undefined,
  tls: REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error('Redis connection failed after 10 retries');
      return null;
    }
    return Math.min(times * 200, 3000);
  },
};

export const redis = new IORedis(redisConfig);
export const redisSubscriber = new IORedis(redisConfig);

redis.on('connect', () => logger.info('🔴 Redis client connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

export const connectRedis = async (): Promise<void> => {
  await redis.ping();
};

// BullMQ connection object
export const bullMQConnection = {
  host: REDIS_HOST,
  port: parseInt(REDIS_PORT, 10),
  password: REDIS_PASSWORD || undefined,
  tls: REDIS_TLS === 'true' ? {} : undefined,
};

// Cache helpers
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  },
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },
  async del(key: string): Promise<void> {
    await redis.del(key);
  },
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  },
};

export default redis;

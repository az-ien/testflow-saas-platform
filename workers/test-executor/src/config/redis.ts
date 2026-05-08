import IORedis from 'ioredis';
import { logger } from './logger';

const {
  REDIS_HOST = 'localhost',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = '',
  REDIS_TLS = 'false',
} = process.env;

export const bullMQConnection = {
  host: REDIS_HOST,
  port: parseInt(REDIS_PORT, 10),
  password: REDIS_PASSWORD || undefined,
  tls: REDIS_TLS === 'true' ? {} : undefined,
};

const redis = new IORedis({
  ...bullMQConnection,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => (times > 5 ? null : times * 500),
});

redis.on('error', (err) => logger.error('Worker Redis error:', err));

export default redis;

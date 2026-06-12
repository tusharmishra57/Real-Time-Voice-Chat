/**
 * Redis client factory
 * Creates separate clients for commands and pub/sub
 * (Redis pub/sub clients cannot issue regular commands while subscribed)
 */
const Redis = require('ioredis');
const logger = require('./logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  lazyConnect: true,
};

/**
 * Creates a new Redis client instance with error/connection logging
 */
function createRedisClient(name = 'default') {
  const client = new Redis(redisConfig);

  client.on('connect', () => logger.info({ client: name }, 'Redis connected'));
  client.on('error', (err) => logger.error({ client: name, err }, 'Redis error'));
  client.on('close', () => logger.warn({ client: name }, 'Redis connection closed'));

  return client;
}

// Singleton clients - shared across the app
const redisClient = createRedisClient('command');         // For GET/SET/INCR etc.
const redisSubscriber = createRedisClient('subscriber'); // Dedicated to SUBSCRIBE

module.exports = { redisClient, redisSubscriber, createRedisClient };

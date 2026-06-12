// src/services/rateLimiter.js
// Redis-based sliding window rate limiter for WebSocket messages
// Limits each userId to N requests per time window

import { redisClient } from '../utils/redisClient.js';
import logger from '../utils/logger.js';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20');
const RL_PREFIX = 'ratelimit:';

/**
 * Checks whether a userId is within the allowed rate limit.
 * Uses a simple counter with a TTL-based reset window.
 *
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, remaining: number, resetInMs: number }>}
 */
export async function checkRateLimit(userId) {
  const key = RL_PREFIX + userId;

  try {
    const pipeline = redisClient.pipeline();
    pipeline.incr(key);
    pipeline.pttl(key); // Get TTL in milliseconds

    const results = await pipeline.exec();
    const count = results[0][1];
    let ttl = results[1][1];

    // If this is the first request in the window, set the TTL
    if (count === 1 || ttl === -1) {
      await redisClient.pexpire(key, WINDOW_MS);
      ttl = WINDOW_MS;
    }

    const allowed = count <= MAX_REQUESTS;
    const remaining = Math.max(0, MAX_REQUESTS - count);

    if (!allowed) {
      logger.warn({ userId, count, max: MAX_REQUESTS }, 'Rate limit: exceeded');
    }

    return { allowed, remaining, resetInMs: ttl };
  } catch (err) {
    // On Redis failure, allow the request to avoid blocking users
    logger.error({ err, userId }, 'Rate limit: Redis error, allowing request');
    return { allowed: true, remaining: MAX_REQUESTS, resetInMs: WINDOW_MS };
  }
}

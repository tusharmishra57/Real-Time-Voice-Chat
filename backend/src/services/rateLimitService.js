/**
 * Redis-based Rate Limiter
 * Uses a sliding window counter per userId.
 * Rejects requests that exceed the configured threshold.
 */
const { redisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20', 10);
const KEY_PREFIX = 'rate_limit:';

/**
 * Check whether a userId is within rate limits
 * Increments their counter and sets TTL on first request in window.
 *
 * @param {string} userId
 * @returns {Promise<{allowed: boolean, remaining: number, resetInMs: number}>}
 */
async function checkRateLimit(userId) {
  const key = `${KEY_PREFIX}${userId}`;
  const windowSeconds = Math.ceil(WINDOW_MS / 1000);

  try {
    // Atomic increment
    const count = await redisClient.incr(key);

    if (count === 1) {
      // First request in this window — set expiry
      await redisClient.expire(key, windowSeconds);
    }

    const ttl = await redisClient.ttl(key);
    const allowed = count <= MAX_REQUESTS;
    const remaining = Math.max(0, MAX_REQUESTS - count);

    if (!allowed) {
      logger.warn({ userId, count, MAX_REQUESTS }, 'Rate limit exceeded');
    }

    return { allowed, remaining, resetInMs: ttl * 1000 };
  } catch (err) {
    // Fail open on Redis errors — don't block users due to infrastructure issues
    logger.error({ err, userId }, 'Rate limit check failed — allowing request');
    return { allowed: true, remaining: MAX_REQUESTS, resetInMs: WINDOW_MS };
  }
}

module.exports = { checkRateLimit };

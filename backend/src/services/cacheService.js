/**
 * Redis Caching Service
 * Caches AI responses keyed by normalized input text.
 * Prevents redundant processing for identical queries.
 */
const { redisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_KEY_PREFIX = 'response_cache:';

/**
 * Normalize text for consistent cache key generation
 * Lowercase, trim, collapse whitespace
 */
function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Build a cache key from user input text
 */
function buildCacheKey(text) {
  return `${CACHE_KEY_PREFIX}${normalizeText(text)}`;
}

/**
 * Retrieve a cached response for the given input text
 * @param {string} inputText
 * @returns {Promise<object|null>} Cached payload or null
 */
async function getCachedResponse(inputText) {
  try {
    const key = buildCacheKey(inputText);
    const cached = await redisClient.get(key);
    if (cached) {
      logger.debug({ key }, 'Cache HIT');
      return JSON.parse(cached);
    }
    logger.debug({ key }, 'Cache MISS');
    return null;
  } catch (err) {
    logger.error({ err }, 'Cache get error — falling through');
    return null; // Fail open: don't block processing on cache errors
  }
}

/**
 * Store a response in cache for future identical queries
 * @param {string} inputText
 * @param {object} payload - { response, intent }
 */
async function setCachedResponse(inputText, payload) {
  try {
    const key = buildCacheKey(inputText);
    await redisClient.setex(key, CACHE_TTL_SECONDS, JSON.stringify(payload));
    logger.debug({ key, ttl: CACHE_TTL_SECONDS }, 'Cache SET');
  } catch (err) {
    logger.error({ err }, 'Cache set error — skipping');
  }
}

module.exports = { getCachedResponse, setCachedResponse };

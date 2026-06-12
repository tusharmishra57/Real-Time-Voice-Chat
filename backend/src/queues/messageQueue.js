/**
 * BullMQ Queue Configuration
 * Defines the "ai-processing" queue where all incoming messages are enqueued.
 * Workers pick jobs off this queue for async processing.
 */
const { Queue } = require('bullmq');
const { createRedisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const QUEUE_NAME = process.env.QUEUE_NAME || 'ai-processing';

// BullMQ requires its own Redis connection with maxRetriesPerRequest: null
const queueRedis = createRedisClient('queue');

const messageQueue = new Queue(QUEUE_NAME, {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,                    // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 1000,                  // Start with 1s, then 2s, 4s
    },
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs for debugging
    removeOnFail: { count: 50 },      // Keep last 50 failed jobs for inspection
  },
});

messageQueue.on('error', (err) => {
  logger.error({ err, queue: QUEUE_NAME }, 'Queue error');
});

/**
 * Add a message processing job to the queue
 * @param {object} payload - { userId, message, socketId, timestamp }
 * @returns {Promise<Job>}
 */
async function enqueueMessage(payload) {
  const job = await messageQueue.add('process-message', payload, {
    jobId: `${payload.userId}-${Date.now()}`, // Unique, traceable job ID
  });

  logger.info(
    { jobId: job.id, userId: payload.userId, queue: QUEUE_NAME },
    'Job enqueued'
  );

  return job;
}

module.exports = { messageQueue, enqueueMessage, QUEUE_NAME };

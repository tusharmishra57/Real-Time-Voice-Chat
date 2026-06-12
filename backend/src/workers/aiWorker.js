/**
 * AI Worker Service
 * Runs as a separate process. Consumes jobs from BullMQ,
 * processes them through STT → AI → DB, then publishes
 * the result to Redis Pub/Sub for the WebSocket server to forward.
 *
 * Start with: node src/workers/aiWorker.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const mongoose = require('mongoose');

const { createRedisClient } = require('../utils/redisClient');
const { processSTT } = require('../services/sttService');
const { generateAIResponse } = require('../services/aiService');
const { getCachedResponse, setCachedResponse } = require('../services/cacheService');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { QUEUE_NAME } = require('../queues/messageQueue');

// Publisher Redis client (dedicated — cannot be shared with BullMQ worker connection)
const publisher = createRedisClient('worker-publisher');

// BullMQ worker connection
const workerRedis = createRedisClient('worker-bullmq');

const PUBSUB_CHANNEL = 'ai-responses';

/**
 * Connect to MongoDB (worker runs standalone, needs its own DB connection)
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_voice_assistant';
  await mongoose.connect(uri);
  logger.info({ uri }, 'Worker: MongoDB connected');
}

/**
 * Core job processor
 * This function is called by BullMQ for every dequeued job
 */
async function processJob(job) {
  const startTime = Date.now();
  const { userId, message, socketId, timestamp } = job.data;

  logger.info({ jobId: job.id, userId, message }, 'Worker: job started');

  // ── Step 1: Speech-to-Text ─────────────────────────────────────────────────
  const processedText = await processSTT(message);
  logger.info({ jobId: job.id, processedText }, 'Worker: STT complete');

  // ── Step 2: Check Cache ────────────────────────────────────────────────────
  let aiResult = await getCachedResponse(processedText);
  let fromCache = false;

  if (aiResult) {
    logger.info({ jobId: job.id, processedText }, 'Worker: cache hit — skipping AI');
    fromCache = true;
  } else {
    // ── Step 3: Generate AI Response ─────────────────────────────────────────
    aiResult = await generateAIResponse(processedText);
    logger.info({ jobId: job.id, intent: aiResult.intent }, 'Worker: AI response generated');

    // ── Step 4: Cache the Response ───────────────────────────────────────────
    await setCachedResponse(processedText, aiResult);
  }

  const processingTimeMs = Date.now() - startTime;

  // ── Step 5: Persist to MongoDB ────────────────────────────────────────────
  try {
    const msg = new Message({
      userId,
      inputMessage: message,
      processedText,
      aiResponse: aiResult.response,
      intent: aiResult.intent,
      fromCache,
      processingTimeMs,
    });
    await msg.save();
    logger.info({ jobId: job.id, messageId: msg._id }, 'Worker: message saved to DB');
  } catch (dbErr) {
    // Don't fail the job due to DB issues — still publish response
    logger.error({ err: dbErr, jobId: job.id }, 'Worker: DB save failed (non-fatal)');
  }

  // ── Step 6: Publish via Redis Pub/Sub ─────────────────────────────────────
  const responsePayload = {
    userId,
    socketId,        // WebSocket server uses this to target the correct client
    processedText,
    response: aiResult.response,
    intent: aiResult.intent,
    fromCache,
    processingTimeMs,
    timestamp,
  };

  await publisher.publish(PUBSUB_CHANNEL, JSON.stringify(responsePayload));
  logger.info({ jobId: job.id, channel: PUBSUB_CHANNEL }, 'Worker: response published to Redis');

  return responsePayload;
}

/**
 * Initialize and start the worker
 */
async function startWorker() {
  await connectDB();
  await publisher.connect();

  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: workerRedis,
    concurrency: 5, // Process up to 5 jobs simultaneously
  });

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, processingTimeMs: result.processingTimeMs }, 'Worker: job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker: worker error');
  });

  logger.info({ queue: QUEUE_NAME, concurrency: 5 }, 'Worker: started and listening for jobs');
}

startWorker().catch((err) => {
  logger.error({ err }, 'Worker: failed to start');
  process.exit(1);
});

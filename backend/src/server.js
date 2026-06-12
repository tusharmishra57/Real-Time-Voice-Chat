/**
 * Server Entry Point
 * Boots MongoDB, Redis, Express, and Socket.io in sequence.
 * Handles graceful shutdown on SIGTERM / SIGINT.
 */
require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');

const app = require('./app');
const { initSocketServer } = require('./websocket/socketHandler');
const { redisClient, redisSubscriber } = require('./utils/redisClient');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT || '4000', 10);

async function bootstrap() {
  // ── 1. Connect to MongoDB (optional) ──────────────────────────────────────
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_voice_assistant';
    await mongoose.connect(mongoUri);
    logger.info({ uri: mongoUri }, 'MongoDB connected');
  } catch (err) {
    logger.warn('MongoDB unavailable — continuing without it. Messages will not be persisted.');
  }

  // ── 2. Connect Redis clients ───────────────────────────────────────────────
  await redisClient.connect();
  await redisSubscriber.connect();
  logger.info('Redis clients connected');

  // ── 3. Create HTTP server and attach WebSocket ─────────────────────────────
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  // ── 4. Start listening ─────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, `Server listening`);
    logger.info('Start the worker with: node src/workers/aiWorker.js');
  });

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down gracefully…');

    httpServer.close(async () => {
      await mongoose.disconnect();
      await redisClient.quit();
      await redisSubscriber.quit();
      logger.info('All connections closed. Goodbye.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Bootstrap failed');
  process.exit(1);
});
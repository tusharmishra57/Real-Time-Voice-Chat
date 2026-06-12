/**
 * WebSocket Handler (Socket.io)
 * Manages client connections, message intake, and response delivery.
 * Subscribes to Redis Pub/Sub to receive processed results from the worker.
 *
 * Architecture:
 *   Client → socket.emit('message') → enqueueMessage() → BullMQ
 *   Redis Pub/Sub → subscriber → socket.to(socketId).emit('response')
 */
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const { enqueueMessage } = require('../queues/messageQueue');
const { checkRateLimit } = require('../services/rateLimitService');
const { redisSubscriber } = require('../utils/redisClient');
const logger = require('../utils/logger');

const PUBSUB_CHANNEL = 'ai-responses';

// Map of socketId → userId for routing responses back to the right client
const socketUserMap = new Map();

/**
 * Attach Socket.io to the HTTP server and wire up event handlers
 * @param {http.Server} httpServer
 */
function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Redis Pub/Sub Subscriber ─────────────────────────────────────────────
  // This runs once globally — worker publishes here, we forward to the correct socket
  redisSubscriber.subscribe(PUBSUB_CHANNEL, (err) => {
    if (err) {
      logger.error({ err, channel: PUBSUB_CHANNEL }, 'Failed to subscribe to Redis channel');
    } else {
      logger.info({ channel: PUBSUB_CHANNEL }, 'WebSocket server subscribed to Redis Pub/Sub');
    }
  });

  redisSubscriber.on('message', (channel, rawMessage) => {
    if (channel !== PUBSUB_CHANNEL) return;

    try {
      const payload = JSON.parse(rawMessage);
      const { socketId, userId, response, processedText, intent, fromCache, processingTimeMs } = payload;

      logger.info({ socketId, userId, channel }, 'WS: received response from Redis, forwarding to client');

      // Emit final AI response to the specific client socket
      io.to(socketId).emit('ai_response', {
        response,
        processedText,
        intent,
        fromCache,
        processingTimeMs,
        timestamp: new Date().toISOString(),
      });

      // Update message status to 'responded'
      io.to(socketId).emit('status_update', { status: 'responded' });
    } catch (err) {
      logger.error({ err }, 'WS: failed to parse Redis message');
    }
  });

  // ── Socket.io Connection Handler ─────────────────────────────────────────
  io.on('connection', (socket) => {
    // Assign a userId if client doesn't provide one (persists across reconnects via localStorage)
    const userId = socket.handshake.auth.userId || uuidv4();
    socketUserMap.set(socket.id, userId);

    logger.info({ socketId: socket.id, userId }, 'WS: client connected');

    // Confirm connection and echo userId back so client can store it
    socket.emit('connected', { socketId: socket.id, userId });

    // ── Message Handler ────────────────────────────────────────────────────
    socket.on('send_message', async (data) => {
      const { message } = data;

      if (!message || typeof message !== 'string' || message.trim() === '') {
        socket.emit('error', { message: 'Invalid message payload' });
        return;
      }

      logger.info({ socketId: socket.id, userId, message }, 'WS: message received');

      // ── Rate Limiting ──────────────────────────────────────────────────
      const { allowed, remaining, resetInMs } = await checkRateLimit(userId);
      if (!allowed) {
        socket.emit('rate_limited', {
          message: `Too many requests. Try again in ${Math.ceil(resetInMs / 1000)} seconds.`,
          resetInMs,
        });
        return;
      }

      // Notify client that message is being processed
      socket.emit('status_update', { status: 'processing', remaining });

      try {
        // Enqueue job — worker will handle STT, AI, DB, and Pub/Sub
        await enqueueMessage({
          userId,
          message: message.trim(),
          socketId: socket.id, // Critical: worker needs this to route response back
          timestamp: new Date().toISOString(),
        });

        socket.emit('status_update', { status: 'queued' });
        logger.info({ socketId: socket.id, userId }, 'WS: message enqueued successfully');
      } catch (err) {
        logger.error({ err, socketId: socket.id }, 'WS: failed to enqueue message');
        socket.emit('error', { message: 'Failed to process message. Please try again.' });
      }
    });

    // ── Disconnect Handler ─────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'WS: client disconnected');
      socketUserMap.delete(socket.id);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

module.exports = { initSocketServer };

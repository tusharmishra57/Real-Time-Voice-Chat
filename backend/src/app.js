/**
 * Express Application
 * Configures middleware, routes, and error handling.
 * Intentionally separated from server.js for testability.
 */
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const { getMessages } = require('./controllers/messageController');

const app = express();

// ── HTTP Request Logging (Pino) ──────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, remoteAddress: req.remoteAddress }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// ── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check — used by load balancers and monitoring
app.get('/health', async (req, res) => {
  const { redisClient } = require('./utils/redisClient');
  const mongoose = require('mongoose');

  let redisStatus = 'disconnected';
  try {
    await redisClient.ping();
    redisStatus = 'connected';
  } catch (_) {}

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: redisStatus,
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    },
  });
});

// Message history endpoint
app.get('/messages', getMessages);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

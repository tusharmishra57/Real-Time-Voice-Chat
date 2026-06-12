// src/utils/database.js
// MongoDB connection using Mongoose

import mongoose from 'mongoose';
import logger from './logger.js';

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/voice_assistant';

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('MongoDB: connected successfully');
  } catch (err) {
    // Non-fatal in dev: app continues without DB persistence
    logger.warn({ err }, 'MongoDB: connection failed — messages will not be persisted');
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB: disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB: runtime error');
  });
}

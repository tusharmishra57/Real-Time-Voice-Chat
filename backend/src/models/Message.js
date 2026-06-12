/**
 * Mongoose schema for storing conversation messages
 * Each document represents one full user→AI exchange
 */
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    // Raw input from the user (text or simulated audio blob identifier)
    inputMessage: {
      type: String,
      required: true,
    },
    // Text after Speech-to-Text processing (same as input for text messages)
    processedText: {
      type: String,
      required: true,
    },
    // The AI-generated response
    aiResponse: {
      type: String,
      required: true,
    },
    // Detected intent from the AI processing layer
    intent: {
      type: String,
      enum: ['greeting', 'question', 'default'],
      default: 'default',
    },
    // Whether this response came from Redis cache
    fromCache: {
      type: Boolean,
      default: false,
    },
    // Job processing duration in milliseconds
    processingTimeMs: {
      type: Number,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('Message', MessageSchema);

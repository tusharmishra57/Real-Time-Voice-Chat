/**
 * AI Processing Service — Rule-Based Engine
 * Performs intent detection via keyword matching and returns
 * context-appropriate responses. In production, replace with
 * calls to OpenAI, Anthropic, or an internal LLM endpoint.
 */
const logger = require('../utils/logger');

// ─── Intent Detection Patterns ──────────────────────────────────────────────

const INTENT_PATTERNS = {
  greeting: [
    /\b(hello|hi|hey|howdy|greetings|good morning|good evening|good afternoon|sup|what's up)\b/i,
  ],
  question: [
    /\b(what|who|where|when|why|how|can you|could you|explain|tell me|describe)\b/i,
    /\?/,
  ],
};

/**
 * Classify user intent from processed text
 * @param {string} text
 * @returns {'greeting'|'question'|'default'}
 */
function detectIntent(text) {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return intent;
    }
  }
  return 'default';
}

// ─── Response Banks ──────────────────────────────────────────────────────────

const RESPONSES = {
  greeting: [
    "Hello! I'm your AI voice assistant. How can I help you today?",
    "Hey there! Great to hear from you. What's on your mind?",
    "Greetings! I'm up and running and ready to assist.",
    "Hi! I'm here and listening. What do you need?",
    "Good to see you! I'm ready whenever you are.",
  ],
  question: [
    "That's a great question! Based on my analysis, the answer involves multiple considerations. Let me break it down: the core principle is straightforward, but the nuances are what make it interesting.",
    "Interesting query! I've processed your question and here's my take: there are several key factors at play here, and understanding them will give you a comprehensive picture.",
    "Great question! Here's a structured response: first, consider the fundamentals. Then, layer in the specifics of your context. Together, they form a complete answer.",
    "I've analyzed your question thoroughly. The short answer is: it depends on the context. The longer answer involves looking at the underlying patterns and principles.",
    "Excellent question! Let me provide a thoughtful response: the topic you're asking about is rich with nuance, and I'll do my best to illuminate the most important aspects.",
  ],
  default: [
    "I've received and processed your message. I'm working on it and here's what I can tell you: your input has been logged, analyzed, and I'm responding in real time.",
    "Message received! I've processed your input through my neural pipeline and I'm ready to assist further. Is there anything specific you'd like to explore?",
    "Got it! I understand what you're saying. My processing indicates that this topic is worth exploring further. Would you like more detail?",
    "Understood! I've analyzed your message and I'm ready to help. Here's my initial response: let's dig into what you're looking for.",
    "Processed! Your message has been analyzed and I'm here to help. Feel free to ask follow-up questions or elaborate on your request.",
  ],
};

/**
 * Pick a random response from a response bank
 * @param {string[]} bank
 */
function pickRandom(bank) {
  return bank[Math.floor(Math.random() * bank.length)];
}

/**
 * Generate an AI response for the given processed text
 * @param {string} processedText - Transcribed / user text
 * @returns {Promise<{response: string, intent: string}>}
 */
async function generateAIResponse(processedText) {
  const intent = detectIntent(processedText);

  // Simulate AI "thinking" time: 300–800ms
  const thinkTime = Math.floor(Math.random() * 500) + 300;
  await new Promise((resolve) => setTimeout(resolve, thinkTime));

  const response = pickRandom(RESPONSES[intent]);

  logger.info({ intent, thinkTime }, 'AI: response generated');

  return { response, intent };
}

module.exports = { generateAIResponse, detectIntent };

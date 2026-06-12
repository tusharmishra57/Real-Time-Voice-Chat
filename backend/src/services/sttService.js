/**
 * Speech-to-Text Service (Simulated)
 * In a real system, this would call Whisper, Google STT, or AWS Transcribe.
 * Here we simulate processing delay and produce dummy transcriptions.
 */
const logger = require('../utils/logger');

/**
 * Detects whether the input looks like an audio blob reference
 * In production: check MIME type / binary signature
 */
function isAudioInput(input) {
  return (
    input.startsWith('audio_') ||
    input.startsWith('blob:') ||
    input.endsWith('.webm') ||
    input.endsWith('.wav')
  );
}

/**
 * Simulated STT responses for audio blobs
 */
const SIMULATED_TRANSCRIPTIONS = [
  "What's the weather like today?",
  "Tell me a joke.",
  "Hello, how are you?",
  "What can you help me with?",
  "Can you explain machine learning?",
  "What time is it?",
  "I need some help with my project.",
  "Give me a fun fact.",
];

/**
 * Process an input through simulated Speech-to-Text
 * @param {string} input - Raw user input (text or audio blob id)
 * @returns {Promise<string>} - Transcribed / passthrough text
 */
async function processSTT(input) {
  // Simulate processing delay: 500–1500ms
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (isAudioInput(input)) {
    // Pick a random simulated transcription
    const transcription =
      SIMULATED_TRANSCRIPTIONS[Math.floor(Math.random() * SIMULATED_TRANSCRIPTIONS.length)];
    logger.info({ input, transcription, delay }, 'STT: audio converted to text');
    return transcription;
  }

  // Plain text input — pass through as-is
  logger.debug({ input, delay }, 'STT: text input passed through');
  return input;
}

module.exports = { processSTT };

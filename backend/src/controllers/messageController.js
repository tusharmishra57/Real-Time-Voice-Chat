/**
 * Message Controller
 * Handles REST API requests related to stored messages
 */
const Message = require('../models/Message');
const logger = require('../utils/logger');

/**
 * GET /messages
 * Returns paginated message history, optionally filtered by userId
 */
async function getMessages(req, res) {
  try {
    const { userId, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const query = userId ? { userId } : {};

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10))
        .skip(skip)
        .lean(),
      Message.countDocuments(query),
    ]);

    logger.info({ userId, total, page }, 'Messages fetched');

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch messages');
    res.status(500).json({ success: false, error: 'Failed to retrieve messages' });
  }
}

module.exports = { getMessages };

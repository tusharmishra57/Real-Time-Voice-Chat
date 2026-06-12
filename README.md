# AI Voice Assistant — Real-Time Full-Stack System

A production-grade, event-driven application demonstrating real-time AI voice assistant architecture using WebSockets, job queues, Redis Pub/Sub, and MongoDB.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYSTEM OVERVIEW                          │
└─────────────────────────────────────────────────────────────────┘

  React UI (port 5173)
      │
      │ WebSocket (Socket.io)
      ▼
  ┌──────────────────────┐
  │   Express Server     │  ← HTTP API (/health, /messages)
  │   + Socket.io        │
  │   (port 4000)        │
  └──────────┬───────────┘
             │ enqueueMessage()
             ▼
  ┌──────────────────────┐
  │   BullMQ Queue       │  ← "ai-processing" queue
  │   (Redis backend)    │
  └──────────┬───────────┘
             │ Worker picks up job
             ▼
  ┌──────────────────────┐
  │   AI Worker Process  │
  │  ┌──────────────┐    │
  │  │ STT Service  │    │  1. Simulate speech-to-text (500–1500ms delay)
  │  └──────┬───────┘    │
  │         │            │
  │  ┌──────▼───────┐    │
  │  │ Cache Check  │    │  2. Check Redis cache for repeated inputs
  │  └──────┬───────┘    │
  │         │            │
  │  ┌──────▼───────┐    │
  │  │  AI Service  │    │  3. Intent detection + response generation
  │  └──────┬───────┘    │
  │         │            │
  │  ┌──────▼───────┐    │
  │  │   MongoDB    │    │  4. Persist full exchange to DB
  │  └──────┬───────┘    │
  │         │            │
  │  ┌──────▼───────┐    │
  │  │ Redis Pub/Sub│    │  5. Publish response to "ai-responses" channel
  │  └──────────────┘    │
  └──────────────────────┘
             │
             │ Redis SUBSCRIBE
             ▼
  ┌──────────────────────┐
  │  Socket.io Server    │  ← Receives from Redis, routes to correct client
  └──────────┬───────────┘
             │ socket.to(socketId).emit('ai_response')
             ▼
  React UI (real-time update)
```

## Tech Stack

| Layer         | Technology          |
|---------------|---------------------|
| Frontend      | React + Vite        |
| WebSocket     | Socket.io           |
| HTTP Server   | Express.js          |
| Queue         | BullMQ              |
| Cache/PubSub  | Redis (ioredis)     |
| Database      | MongoDB (Mongoose)  |
| Logging       | Pino                |

## Project Structure

```
project/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Express app (middleware, routes)
│   │   ├── server.js               # Entry point (boots all services)
│   │   ├── controllers/
│   │   │   └── messageController.js
│   │   ├── models/
│   │   │   └── Message.js          # Mongoose schema
│   │   ├── queues/
│   │   │   └── messageQueue.js     # BullMQ queue definition
│   │   ├── services/
│   │   │   ├── aiService.js        # Intent detection + response generation
│   │   │   ├── cacheService.js     # Redis caching layer
│   │   │   ├── rateLimitService.js # Redis rate limiting
│   │   │   └── sttService.js       # Simulated speech-to-text
│   │   ├── utils/
│   │   │   ├── logger.js           # Pino logger
│   │   │   └── redisClient.js      # Redis client factory
│   │   ├── websocket/
│   │   │   └── socketHandler.js    # Socket.io setup + Redis sub
│   │   └── workers/
│   │       └── aiWorker.js         # Standalone BullMQ worker process
│   ├── .env.example
│   └── package.json
└── client/
    ├── src/
    │   ├── App.jsx                 # Root component + socket management
    │   ├── components/
    │   │   ├── ChatWindow.jsx      # Message history display
    │   │   └── MessageInput.jsx    # Text input + audio simulation
    │   ├── services/
    │   │   └── socket.js           # Socket.io client singleton
    │   └── main.jsx
    ├── index.html
    └── package.json
```

## Setup & Running

### Prerequisites

- Node.js 18+
- Redis running locally (`redis-server` or Docker)
- MongoDB running locally or a MongoDB Atlas connection string

### 1. Start Redis

```bash
# Local Redis
redis-server

# Or via Docker
docker run -d -p 6379:6379 redis:alpine
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set MONGODB_URI to your connection string
npm install
```

### 3. Start the Backend Server

```bash
# Terminal 1
cd backend
npm start
# Server starts on http://localhost:4000
```

### 4. Start the Worker

```bash
# Terminal 2 — MUST run separately
cd backend
npm run worker
# Worker connects to BullMQ and starts consuming jobs
```

### 5. Start the Frontend

```bash
# Terminal 3
cd client
npm install
npm run dev
# UI opens at http://localhost:5173
```

### MongoDB Connection

In `backend/.env`, set:
```
MONGODB_URI=mongodb://localhost:27017/ai_voice_assistant
# or Atlas:
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai_voice_assistant
```

The schema is auto-created on first message. No migration needed.

## API Endpoints

| Method | Path        | Description                          |
|--------|-------------|--------------------------------------|
| GET    | /health     | Server + Redis + MongoDB status      |
| GET    | /messages   | Paginated message history            |

Query params for `/messages`: `?userId=xxx&page=1&limit=50`

## WebSocket Events

### Client → Server

| Event          | Payload                  | Description             |
|----------------|--------------------------|-------------------------|
| `send_message` | `{ message: string }`    | Send text or audio blob |

### Server → Client

| Event           | Payload                                      | Description                    |
|-----------------|----------------------------------------------|--------------------------------|
| `connected`     | `{ socketId, userId }`                       | Connection confirmed           |
| `status_update` | `{ status: 'queued'\|'processing'\|... }`    | Job progress update            |
| `ai_response`   | `{ response, intent, fromCache, ms, ... }`   | Final AI response              |
| `rate_limited`  | `{ message, resetInMs }`                     | Rate limit exceeded            |

## How the Queue + Worker Work

1. When a message arrives via WebSocket, `enqueueMessage()` adds a BullMQ job to the `ai-processing` queue.
2. The worker process (running separately) picks up jobs with up to 5 concurrent workers.
3. Each job goes through: **STT → Cache check → AI → MongoDB → Redis Pub/Sub**.
4. The WebSocket server subscribes to `ai-responses` on Redis. When a message arrives, it routes to the correct Socket.io client using the `socketId` stored in the job payload.
5. Failed jobs are automatically retried up to 3 times with exponential backoff (1s → 2s → 4s).

## Key Design Decisions

- **Separate worker process**: The worker runs as an independent process so it can be scaled horizontally (run multiple workers consuming the same queue).
- **Redis Pub/Sub for response routing**: The worker doesn't have access to Socket.io, so it publishes responses to Redis. The WebSocket server subscribes and forwards.
- **Fail-open on infrastructure errors**: Rate limiting and caching both fail open — if Redis is temporarily unavailable, requests are still processed.
- **Dedicated Redis clients**: BullMQ, pub/sub subscribers, and regular commands each require their own Redis connection. Three separate clients are created.

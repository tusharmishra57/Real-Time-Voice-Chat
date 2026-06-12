/**
 * Socket.io client service
 */
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const storedUserId = localStorage.getItem('ai_assistant_userId');

const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: { userId: storedUserId || undefined },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on('connected', ({ userId }) => {
  if (userId) localStorage.setItem('ai_assistant_userId', userId);
});

export default socket;

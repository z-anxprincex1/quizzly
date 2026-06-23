import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { registerSocketHandlers } from './sockets/room-handler';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'quizly-jwt-secret-key-super-secure-change-in-prod';

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'quizly-backend' });
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
  if (!token) {
    return next(new Error('Authentication required.'));
  }

  try {
    const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId: string; username: string; isGuest: boolean };
    socket.data.user = decoded;
    return next();
  } catch (err) {
    console.error('Socket authentication error:', err);
    return next(new Error('Invalid or expired authentication.'));
  }
});

registerSocketHandlers(io, prisma);

server.listen(PORT, () => {
  console.log(`[Backend] Express + Socket.io Server running on port ${PORT}`);
});

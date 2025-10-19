// apps/api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';

// ⬇️ This is Node's built-in HTTP module (no extra install needed)
import http from 'http';

import { Server as IOServer } from 'socket.io';

import { prisma } from './services/prisma'; // connect to Prisma
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { submissionsRouter } from './routes/submissions';
// import { commentsRouter } from './routes/comments';
// import { reactionsRouter } from './routes/reactions';

const app = express();

// Security & middleware
app.use(cors({ origin: 'http://localhost:9000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(pino());

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);
app.use('/submissions', submissionsRouter);
// app.use('/comments', commentsRouter);
// app.use('/reactions', reactionsRouter);

// create an io instance, and in the browser create a socket and listen/emit events.
// Create a real HTTP server from Express app
// Socket.IO attaches to THIS same server, same port (3000)
const server = http.createServer(app);

// Create Socket.IO server and allow the frontend origin
const io = new IOServer(server, {
  cors: { origin: 'http://localhost:9000' }
});

// Export emitter for routes to use
export function emitToSubmission(submissionId: number, event: string, payload: any) {
  io.to(`submission:${submissionId}`).emit(event, payload);
}

// Handle new websocket connections - Join a submission room
io.on('connection', (socket) => {
  // 'socket' represents one connected client/browser.
  // It has:
    // - an id (socket.id)
    // - methods like .join(room), .leave(room), .emit(event, payload)
    // - event listeners via socket.on('event', handler)

  // Code decides what rooms to join based on context
  socket.on('join', (submissionId: number) => {
    socket.join(`submission:${submissionId}`);
  });
});

// Test route
app.get('/health', async (_, res) => {
  const users = await prisma.user.findMany();
  res.json({ ok: true, userCount: users.length });
});

// global error handler (last middleware)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({ error: err?.message ?? 'Internal Server Error' });
});

// IMPORTANT: listen with the HTTP server (NOT app.listen)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ API running at http://localhost:${PORT}`));
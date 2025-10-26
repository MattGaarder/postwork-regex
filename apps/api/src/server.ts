// apps/api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';

import { assertDbConnection } from './services/prisma';
(async () => {
  await assertDbConnection();
})();

// ⬇️ This is Node's built-in HTTP module (no extra install needed)
// import http from 'http';
// import { WebSocketServer } from 'ws'
// import { setupWSConnection } from 'y-websocket/bin/utils.js'


const app = express();

import { prisma } from './services/prisma'; // connect to Prisma
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';

import { versionsRouter } from './routes/versions';
import { commentsRouter } from './routes/comments';
// import { reactionsRouter } from './routes/reactions';


// Security & middleware
app.use(cors({ origin: 'http://localhost:9000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(pino());

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);

app.use('/projects', versionsRouter);
app.use('/projects/:projectId', commentsRouter);
// app.use('/reactions', reactionsRouter);

// Global error handler...
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  const status = typeof err?.status === 'number' ? err.status : 500
  res.status(status).json({ error: err?.message ?? 'Internal Server Error' })
})

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



const PORT = Number(process.env.PORT || 3000)

app.listen(PORT, () => {
  console.log(`✅ API + Yjs WS on http://localhost:${PORT}`);
  console.log(`   Yjs WebSocket endpoint: ws://localhost:1234/yjs`);
})
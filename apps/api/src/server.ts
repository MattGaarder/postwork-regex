// apps/api/src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';

import { prisma } from './services/prisma'; // connect to Prisma
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors({ origin: 'http://localhost:9000', credentials: true }));
app.use(express.json());
app.use(pino());

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running at http://localhost:${PORT}`));
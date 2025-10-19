// apps/api/src/routes/comments.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
import { emitToSubmission } from '../server';

export const commentsRouter = Router();
commentsRouter.use(requireAuth);

const CreateComment = z.object({
  submissionId: z.number(),
  line: z.number().optional(), // 1-based
  body: z.string().min(1),
});

commentsRouter.post('/', async (req: AuthReq, res) => {
  const parsed = CreateComment.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { submissionId, line, body } = parsed.data;

  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) return res.status(404).json({ error: 'Submission not found' });

  const project = await prisma.project.findUnique({ where: { id: sub.projectId } });
  if (!project || project.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const c = await prisma.comment.create({
    data: {
      submissionId,
      authorId: req.user!.id,
      line: line ?? null,
      body,
    },
    include: { author: true, reactions: true },
  });

  emitToSubmission(submissionId, 'comment:created', c);
  res.status(201).json(c);
});

commentsRouter.get('/by-submission/:submissionId', async (req: AuthReq, res) => {
  const submissionId = Number(req.params.submissionId);
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) return res.status(404).json({ error: 'Submission not found' });

  const project = await prisma.project.findUnique({ where: { id: sub.projectId } });
  if (!project || project.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const list = await prisma.comment.findMany({
    where: { submissionId },
    include: { author: true, reactions: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(list);
});
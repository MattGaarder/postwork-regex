// apps/api/src/routes/submissions.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
import { emitToSubmission } from '../server';

export const submissionsRouter = Router();

submissionsRouter.use(requireAuth);

const CreateSubmission = z.object({
  projectId: z.number(),
  title: z.string().min(1),
  language: z.string().min(1),
  code: z.string().min(1),
});

submissionsRouter.post('/', async (req: AuthReq, res) => {
  const parsed = CreateSubmission.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { projectId, language, title, code } = parsed.data;

  // ensure project belongs to user or has access
  // findUnique() is a read/query operation — it doesn’t modify the database or “set” anything.
  // just a lookup, equivalent to this SQL under the hood:
  // SELECT * FROM "Project" WHERE "id" = <projectId> LIMIT 1;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const sub = await prisma.submission.create({
    data: {
      projectId,
      authorId: req.user!.id,
      language,
      title,
      code,
    },
  });

  // notify room
  emitToSubmission(sub.id, 'submission:created', sub);
  res.status(201).json(sub);
});

submissionsRouter.get('/:id', async (req: AuthReq, res) => {
  const id = Number(req.params.id);
  const sub = await prisma.submission.findUnique({
    where: { id },
    include: { comments: { include: { author: true } } },
  });
  if (!sub) return res.status(404).json({ error: 'Not found' });

  // authorize (owner only for now — add collaborators later)
  const project = await prisma.project.findUnique({ where: { id: sub.projectId } });
  if (!project || project.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(sub);
});

const UpdateSubmission = z.object({
  code: z.string().min(1),
});

submissionsRouter.patch('/:id', async (req: AuthReq, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSubmission.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const project = await prisma.project.findUnique({ where: { id: sub.projectId } });
  if (!project || project.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await prisma.submission.update({
    where: { id },
    data: { code: parsed.data.code },
  });

  emitToSubmission(id, 'submission:updated', { id, code: updated.code });
  res.json(updated);
});
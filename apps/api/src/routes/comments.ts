// src/routes/comments.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
import { ensureVersionAccess } from '../services/guards';

export const commentsRouter = Router();
commentsRouter.use(requireAuth);

// GET /versions/:versionId/comments
commentsRouter.get('/versions/:versionId/comments', async (req: AuthReq, res) => {
  const versionId = Number(req.params.versionId);
  const access = await ensureVersionAccess(req.user!.id, versionId);
  if (!access.ok) return res.status(access.status).json({ error: access.msg });

  const roots = await prisma.comment.findMany({
    where: { versionId, parentId: null },
    orderBy: [{ line: 'asc' }, { createdAt: 'asc' }],
    include: {
      author: { select: { id: true, name: true, email: true } },
      children: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  res.json(roots);
});

// POST /versions/:versionId/comments
const CreateComment = z.object({
  line: z.number().int().positive(),        // 1-based line anchor
  body: z.string().min(2),
  parentId: z.number().int().optional(),    // reply-to
});

commentsRouter.post('/versions/:versionId/comments', async (req: AuthReq, res) => {
  const versionId = Number(req.params.versionId);
  const parsed = CreateComment.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const access = await ensureVersionAccess(req.user!.id, versionId);
  if (!access.ok) return res.status(access.status).json({ error: access.msg });

  // Guard: if parentId present, it must belong to the same version
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.versionId !== versionId) {
      return res.status(400).json({ error: 'Invalid parentId for this version' });
    }
  }

  // Optional guard: validate line range vs code line count
  const v = await prisma.version.findUnique({ where: { id: versionId }, select: { content: true } });
  if (!v) return res.status(404).json({ error: 'Version not found' });
  const lineCount = v.content.split('\n').length;
  if (parsed.data.line < 1 || parsed.data.line > lineCount) {
    return res.status(400).json({ error: `line must be between 1 and ${lineCount}` });
  }

  // Award points (+2 per comment). Keep it simple and transparent.
  const POINTS_PER_COMMENT = 2;

  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        versionId,
        authorId: req.user!.id,
        line: parsed.data.line,
        body: parsed.data.body,
        parentId: parsed.data.parentId ?? null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        children: true,
      },
    });

    // Update denormalized counters
    await tx.userStat.upsert({
      where: { userId: req.user!.id },
      update: { commentsCount: { increment: 1 }, points: { increment: POINTS_PER_COMMENT } },
      create: { userId: req.user!.id, commentsCount: 1, points: POINTS_PER_COMMENT },
    });

    // Optional: keep a review activity audit
    await tx.reviewActivity.create({
      data: {
        userId: req.user!.id,
        projectId: access.projectId,
        versionId,
        type: 'COMMENT',
        points: POINTS_PER_COMMENT,
      } as any,
    });

    return comment;
  });

  res.status(201).json(result);
});

// POST /comments/:id/reactions { kind: 'upvote' }
const ReactSchema = z.object({ kind: z.string().min(1) });
commentsRouter.post('/comments/:id/reactions', async (req: AuthReq, res) => {
  const commentId = Number(req.params.id);
  const parsed = ReactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const c = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { versionId: true, version: { select: { projectId: true } } },
  });
  if (!c) return res.status(404).json({ error: 'Comment not found' });

  // access via version
  const access = await ensureVersionAccess(req.user!.id, c.versionId);
  if (!access.ok) return res.status(access.status).json({ error: access.msg });

  try {
    const r = await prisma.reaction.create({
      data: { commentId, userId: req.user!.id, kind: parsed.data.kind },
    });
    res.status(201).json(r);
  } catch (e) {
    // unique([commentId, userId, kind]) -> 409 conflict on duplicate
    return res.status(409).json({ error: 'Already reacted' });
  }
});
// apps/api/src/routes/comments.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
// import { ensureVersionAccess } from '../middleware/guards';

export const commentsRouter = Router({ mergeParams: true });
commentsRouter.use(requireAuth);

const CreateComment = z.object({
    line: z.number().int().positive().optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    body: z.string().min(1),
//   parentId: z.number().int().optional(),
});
// note the body property naming here - cross reference to below
// const created = await prisma.comment.create({
//   data: {
//     versionId,
//     line: parsed.data.line,
//     content: parsed.data.body, // 👈 here is the mapping
//     authorId: req.user!.id,
//   },
// });


// GET: list roots with children for a version
commentsRouter.get('/v/:versionId/comments', async (req: AuthReq, res) => {
  const versionId = Number(req.params.versionId);
//   const access = await ensureVersionAccess(req.user!.id, versionId);
//   if (!access.ok) return res.status(access.status).json({ error: access.msg });

  const comments = await prisma.comment.findMany({
    where: { versionId },
    orderBy: [{ lineStart: 'asc' }, { createdAt: 'asc' }],
    select: {
        id: true,
        versionId: true,

        lineStart: true,
        lineEnd: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
    },
  });
  res.json(comments);
});

// POST: create a new comment (root or reply)
commentsRouter.post('/v/:versionId/comments', async (req: AuthReq, res) => {
  const versionId = Number(req.params.versionId);
  const parsed = CreateComment.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

//   const access = await ensureVersionAccess(req.user!.id, versionId);
//   if (!access.ok) return res.status(access.status).json({ error: access.msg });

//   if (parsed.data.parentId) {
//     const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
//     if (!parent || parent.versionId !== versionId) {
//       return res.status(400).json({ error: 'invalid parentId for this version' });
//     }
//   }

// Prisma generates a create method for each model in your schema.
// Since you have model Comment { ... }, you automatically get:
// 	•	prisma.comment.create() – insert one new record
// data and select are valid keys — not something arbitrary.
  const created = await prisma.comment.create({
    // data is where you define what data to insert into the database.
    data: {
        versionId,
        // line: parsed.data.line,
        lineStart: parsed.data.lineStart,
        lineEnd: parsed.data.lineEnd,
        content: parsed.data.body,
        authorId: req.user!.id,
        // parentId: parsed.data.parentId ?? null,
    },
    // select controls what data Prisma returns back to you after the insert succeeds.
    // If you don’t specify select, Prisma returns the entire record (all columns and any relations you included).
    select: { 
        id: true,
        versionId: true,
        // line: true,
        lineStart: true,
        lineEnd: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
    },
  });
  res.status(201).json(created);
});
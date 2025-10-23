// apps/api/src/projects.ts
// A) Register → Projects page → List projects
// 	1.	User fills form and clicks Register (frontend).
// 	2.	Frontend POST /auth/register with { email, password, name }.
// 	3.	Backend creates user, returns { token, user }.
// 	4.	Frontend saves token (auth.setAuth(...)), then router.push('/projects') (navigate only).
// 	5.	Projects page mounted → it calls GET /projects to load data.
// 	6.	Backend requireAuth checks token → ok → returns JSON list (probably [] at first).
// 	7.	Frontend renders the list.

// B) Login → Projects page → Create project
// 	1.	User clicks Login (frontend).
// 	2.	Frontend POST /auth/login with { email, password }.
// 	3.	Backend verifies, returns { token, user }.
// 	4.	Frontend saves token, router.push('/projects').
// 	5.	Projects page calls GET /projects (needs token).
// 	6.	To create one, frontend POST /projects with { name, description? }.
// 	7.	Backend requireAuth verifies token → creates project with ownerId = req.user!.id → returns 201.
// 	8.	Frontend shows the new project (maybe refetches with GET /projects).

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get('/', async (req: AuthReq, res) => {
  // http://localhost:3000/projects and return JSON.
  const projects = await prisma.project.findMany({ where: { ownerId: req.user!.id } });
  res.json(projects);
});

// MIDDLEWARE src/middleware/requireAuth.ts

// export function requireAuth(req: AuthReq, res: Response, next: NextFunction) {
//   const token = req.headers.authorization?.replace('Bearer ', '');
//   if (!token) return res.status(401).json({ error: 'No token' });
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number };
//     req.user = { id: payload.id };
//     next();
//   } catch {
//     res.status(401).json({ error: 'Invalid token' });
//   }
// }


const CreateProject = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  language: z.enum(['JAVASCRIPT', 'PYTHON', 'JAVA']),
});

projectsRouter.post('/', async (req: AuthReq, res) => {
  const parsed = CreateProject.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { name, description, language } = parsed.data;
  const project = await prisma.project.create({
    data: {
      ownerId: req.user!.id,
      name,
      description: description ?? null, // turn undefined into null
      language
    }
  });
  res.status(201).json(project);
});

projectsRouter.delete('/:id', async (req: AuthReq, res) => {
  const id = Number(req.params.id);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.ownerId !== req.user!.id) return res.status(404).json({ error: 'Not found' });
  await prisma.project.delete({ where: { id } });
  res.status(204).send();
});

projectsRouter.get('/:id/v', async (req: AuthReq, res) => {
  const id = Number(req.params.id)
  const subs = await prisma.version.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
  })
  res.json(subs)
})


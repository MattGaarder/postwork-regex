// apps/api/src/routes/versions.ts
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/prisma'
import { requireAuth, AuthReq } from '../middleware/requireAuth'

export const versionsRouter = Router()
versionsRouter.use(requireAuth)

// Allow owner or member
async function assertProjectMember(projectId: number, userId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return false
  if (project.ownerId === userId) return true
  const member = await prisma.projectMember.findFirst({ where: { projectId, userId } })
  return !!member
}


// zod for POST body
const CreateVersion = z.object({
  content: z.string().min(0),
  language: z.enum(['JAVASCRIPT', 'PYTHON', 'JAVA']).optional(),
})


versionsRouter.use((req, _res, next) => {
  console.log('[versionsRouter]', req.method, req.originalUrl, 'body=', req.body);
  next();
});
// GET /projects/:projectId/versions
// List versions (id, authorId, createdAt, updatedAt, language)
versionsRouter.get('/:projectId/v', async (req: AuthReq, res) => {
  try {
    const projectId = +req.params.projectId
    console.log('[GET v list] params', req.params, 'user', req.user);

    if (Number.isNaN(projectId)) {
      console.log('[GET v list] bad projectId')
      return res.status(400).json({ error: 'Invalid projectId' })
    }

    const allowed = await assertProjectMember(projectId, req.user!.id);
    console.log('[GET v list] allowed?', allowed);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const versions = await prisma.version.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        language: true,
      },
    });
    console.log('[GET v list] found', versions.length);
    res.json(versions); 
  } catch (error) {
    console.error('[GET v list] error', error);
    res.status(500).json({ error: 'Server error' });
  }
})


// GET /projects/:projectId/v/:versionId
// Fetch one version (full content)
versionsRouter.get('/:projectId/v/:versionId', async (req: AuthReq, res) => {
  try {
    // the unary plus operator (+) converts a value into a number.
    const projectId = +req.params.projectId;
    const versionId = +req.params.versionId;
    console.log('[GET v one] params', req.params, 'user', req.user);

    if (Number.isNaN(projectId) || Number.isNaN(versionId)) {
      console.log('[GET v one] bad ids', { projectId, versionId });
      return res.status(400).json({ error: 'Invalid ids' });
    }

    if (!(await assertProjectMember(projectId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }


    const version = await prisma.version.findFirst({ where: { id: versionId, projectId } });
    console.log('[GET v one] found?', !!version);
    if (!version) return res.status(404).json({ error: 'Not found' });
    res.json(version);
    } catch (error) {
    console.error('[GET v one] error', error);
    res.status(500).json({ error: 'Server error' });
  }
})


// POST /:projectId/versions
// Create a new version (snapshot). Treat versions as immutable.
// body: { content: string, language?: 'JAVASCRIPT'|'PYTHON'|'JAVA' }
// If language is omitted, we default to the project.language.

versionsRouter.post('/:projectId/v', async (req: AuthReq, res) => {
  const projectId = +req.params.projectId
  console.log('POST create version for projectId=', projectId, 'payload=', req.body);
  if (!(await assertProjectMember(projectId, req.user!.id))) {
    console.log('Forbidden: user', req.user!.id, 'not a member of project', projectId);
    return res.status(403).json({ error: 'Forbidden' })
  }

  const parsed = CreateVersion.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(parsed.error.flatten())
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const language = parsed.data.language ?? project.language
  const content = parsed.data.content

  const version = await prisma.version.create({
    data: {
      projectId,
      authorId: req.user!.id,
      language,
      content,
    },
  })
  console.log('Created version id=', version.id);
  res.status(201).json(version)
})

export default versionsRouter
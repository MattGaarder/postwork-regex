// apps/api/src/middleware/guards.ts
import { prisma } from '../services/prisma';
export async function ensureProjectMember(userId: number, projectId: number) {
  const member = await prisma.projectMember.findFirst({ where: { userId, projectId } });
  const owns   = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!member && !owns) throw Object.assign(new Error('Forbidden'), { status: 403 });
}
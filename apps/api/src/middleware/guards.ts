// src/services/guards.ts
import { prisma } from '../services/prisma';

export async function ensureVersionAccess(userId: number, versionId: number) {
  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { projectId: true, project: { select: { ownerId: true } } },
  });
  if (!version) return { ok: false as const, status: 404, msg: 'Version not found' };

  const isOwner = version.project.ownerId === userId;
  if (isOwner) return { ok: true as const, projectId: version.projectId };

  const membership = await prisma.projectMember.findFirst({
    where: { userId, projectId: version.projectId },
  });
  if (!membership) return { ok: false as const, status: 403, msg: 'Not a project member' };

  return { ok: true as const, projectId: version.projectId };
}
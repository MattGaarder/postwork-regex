// apps/api/src/services/prisma.ts
import { PrismaClient } from '@prisma/client';

// Create one Prisma client for the whole app
export const prisma = new PrismaClient();

// (optional) Gracefully disconnect when the Node process exits
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
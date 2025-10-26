// prisma/seed.ts
import { PrismaClient, MemberRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean slate (respecting FK order)
  await prisma.comment.deleteMany({});
  await prisma.version.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({}); // optional: reset users for truly clean runs

  // Users (idempotent alternative: use upsert if you want to keep existing)
  const [alice, bob, carol] = await Promise.all([
    createUser('alice@example.com', 'Alice'),
    createUser('bob@example.com', 'Bob'),
    createUser('carol@example.com', 'Carol'),
  ]);

  // Projects
  const projA = await prisma.project.create({
    data: {
      ownerId: alice.id,
      name: 'Code Review Platform',
      description: 'Real-time collaborative code review with versions and comments.',
      language: 'JAVASCRIPT',

      createdAt: new Date('2025-01-10T10:00:00Z'),
    },
  });

  const projB = await prisma.project.create({
    data: {
      ownerId: bob.id,
      name: 'Static Analyzer',
      description: 'Python-based static analysis for student submissions.',
      language: 'PYTHON',

      createdAt: new Date('2025-01-12T15:30:00Z'),
    },
  });

  // Project members (include owners explicitly)
  await prisma.projectMember.createMany({
    data: [
      { projectId: projA.id, userId: alice.id, role: MemberRole.OWNER },
      { projectId: projA.id, userId: bob.id,   role: MemberRole.MAINTAINER },
      { projectId: projA.id, userId: carol.id, role: MemberRole.REVIEWER },

      { projectId: projB.id, userId: bob.id,   role: MemberRole.OWNER },
      { projectId: projB.id, userId: alice.id, role: MemberRole.REVIEWER },
    ],
    skipDuplicates: true,
  });

  // Versions
  const vA1 = await prisma.version.create({
    data: {
      projectId: projA.id,
      language: 'JAVASCRIPT',
      code: `// v1
function add(a,b){return a+b}
console.log(add(2,3))`,
      authorId: alice.id,
      createdAt: new Date('2025-01-11T09:00:00Z'),
    },
  });

  const vA2 = await prisma.version.create({
    data: {
      projectId: projA.id,
      language: 'JAVASCRIPT',
      code: `// v2 - refactor
const add=(a,b)=>a+b;
console.log(add(5,7))`,
      authorId: bob.id,
      createdAt: new Date('2025-01-12T11:15:00Z'),
    },
  });

  const vB1 = await prisma.version.create({
    data: {
      projectId: projB.id,
      language: 'PYTHON',
      code: `# v1
def add(a,b):
    return a+b
print(add(2,3))`,
      authorId: bob.id,
      createdAt: new Date('2025-01-13T10:45:00Z'),
    },
  });

  // Comments with content (including a threaded reply)
  const c1 = await prisma.comment.create({
    data: {
      versionId: vA2.id,
      line: 2,
      content: 'Nit: consider naming this addNumbers for clarity.',
      authorId: carol.id,
      createdAt: new Date('2025-01-12T11:20:00Z'),
    },
  });

  await prisma.comment.create({
    data: {
      versionId: vA2.id,
      line: 2,
      content: 'Good call — I will rename in the next commit.',
      authorId: alice.id,
      parentId: c1.id,
      createdAt: new Date('2025-01-12T11:25:00Z'),
    },
  });

  await prisma.comment.create({
    data: {
      versionId: vB1.id,
      line: 1,
      content: 'PEP8: add a blank line after imports and before function defs.',
      authorId: alice.id,
      createdAt: new Date('2025-01-13T11:00:00Z'),
    },
  });

  console.log('✅ Seed completed.');
}

async function createUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash('password123', 10);
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      createdAt: new Date('2025-01-10T09:00:00Z'),
    },
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
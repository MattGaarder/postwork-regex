// prisma/seed.ts
import { PrismaClient, MemberRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1️⃣ Create Users
  const password = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      passwordHash: password,
      name: 'Alice',
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      passwordHash: password,
      name: 'Bob',
    },
  });

  // 2️⃣ Create a Project owned by Alice
  const project = await prisma.project.create({
    data: {
      name: 'Collaborative Code Review Demo',
      description: 'Example project for testing seeding',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: MemberRole.OWNER },
          { userId: bob.id, role: MemberRole.REVIEWER },
        ],
      },
    },
    include: { members: true },
  });

  // 3️⃣ Create a Submission
  const submission = await prisma.submission.create({
    data: {
      projectId: project.id,
      authorId: bob.id,
      title: 'Bubble Sort Example',
      language: 'javascript',
      code: `
function bubbleSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        const temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  return arr;
}
console.log(bubbleSort([5,3,8,4,2]));
      `,
    },
  });

  // 4️⃣ Create a Comment
  const comment = await prisma.comment.create({
    data: {
      submissionId: submission.id,
      authorId: alice.id,
      body: 'Nice implementation! Maybe use const instead of let for temp?',
      lineStart: 4,
      lineEnd: 4,
    },
  });

  // 5️⃣ Create a Reaction (Bob upvotes Alice’s comment)
  await prisma.reaction.create({
    data: {
      commentId: comment.id,
      userId: bob.id,
      kind: 'upvote',
    },
  });

  // 6️⃣ Create UserStat rows
  await prisma.userStat.createMany({
    data: [
      { userId: alice.id, points: 10, commentsCount: 1 },
      { userId: bob.id, points: 5, commentsCount: 0 },
    ],
  });

  console.log('✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
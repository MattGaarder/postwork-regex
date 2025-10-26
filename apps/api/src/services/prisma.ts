// apps/api/src/services/prisma.ts
import { PrismaClient } from '@prisma/client';
import 'dotenv/config'; // <-- ensure .env is loaded for the running process

// Create one Prisma client for the whole app
export const prisma = new PrismaClient();

// (optional) Gracefully disconnect when the Node process exits
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export async function assertDbConnection() {
  try {
    // show DB + schema
    const info = await prisma.$queryRawUnsafe<{ current_database: string; current_schema: string }[]>(
      `select current_database() as current_database, current_schema() as current_schema`
    );
    console.log('[DB]', info[0]);

    // list candidate table names (quoted User vs unquoted)
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name in ('User','user','users');`
    );
    console.log('[DB] candidate user tables:', tables.map(t => t.table_name));
  } catch (e) {
    console.error('[DB] assert failed:', e);
  }
}
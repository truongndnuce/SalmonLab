import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { TEST_DB, testDatabaseUrl } from './setup-env';

export default async function globalSetup() {
  const admin = new PrismaClient({
    datasourceUrl: testDatabaseUrl().replace(`/${TEST_DB}`, '/postgres'),
  });
  try {
    const rows = await admin.$queryRaw<
      { exists: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}) AS exists`;
    if (!rows[0].exists)
      await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.$disconnect();
  }
  execSync('npx prisma migrate deploy', {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}

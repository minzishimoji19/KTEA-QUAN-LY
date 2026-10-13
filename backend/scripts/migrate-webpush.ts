import prisma from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20261013_add_web_push_tables', 'migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--') && line.trim().length > 0)
    .join('\n');

  const statements = withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let i = 0;
  for (const stmt of statements) {
    i++;
    console.log(`[${i}] Executing: ${stmt.substring(0, 100)}...`);
    try {
      await (prisma as any).$executeRawUnsafe(stmt);
      console.log(`    ✓ OK`);
    } catch (e: any) {
      console.error(`    ✗ FAILED: ${e.message}`);
      throw e;
    }
  }
  console.log('\n✅ Web Push Migration complete!');
}

runMigration()
  .then(() => (prisma as any).$disconnect())
  .catch(async (e) => {
    console.error('Migration aborted:', e);
    await (prisma as any).$disconnect();
    process.exit(1);
  });

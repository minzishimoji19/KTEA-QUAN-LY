import prisma from '../config/database.js';
import { PaginationMeta } from '../types/api.js';

/**
 * Health check utility to ping database and return status and latency
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  database: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
      database: 'MySQL',
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      database: 'MySQL',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Calculates standard pagination metadata
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.ceil(total / safeLimit) || 1;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}

/**
 * Safely executes operations inside an interactive Prisma transaction
 */
export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return prisma.$transaction(callback);
}

/**
 * Cleans all records in correct foreign key dependency order
 * Used for testing environments and database resets
 */
export async function cleanDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  await prisma.pushRecord.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.customerTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.customerActivity.deleteMany();
  await prisma.customerCase.deleteMany();
  await prisma.customerNeed.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
}

export default {
  checkDatabaseHealth,
  buildPaginationMeta,
  withTransaction,
  cleanDatabase,
};

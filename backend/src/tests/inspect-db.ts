import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const customerCount = await prisma.customer.count();
  const productCount = await prisma.product.count();
  const caseCount = await prisma.customerCase.count();
  const statuses = await prisma.customer.groupBy({
    by: ['overallStatus'],
    _count: { _all: true },
  });
  const priorities = await prisma.customer.groupBy({
    by: ['priority'],
    _count: { _all: true },
  });
  const sources = await prisma.customerSource.findMany();
  const customersWithVib = await prisma.customer.count({
    where: {
      OR: [
        { source: 'VIB' },
        { customerSource: { name: 'VIB' } },
      ],
    },
  });

  console.log('--- DATABASE INSPECTION REPORT ---');
  console.log('Customer Count:', customerCount);
  console.log('Product Count:', productCount);
  console.log('Case Count:', caseCount);
  console.log('Statuses in DB:', JSON.stringify(statuses, null, 2));
  console.log('Priorities in DB:', JSON.stringify(priorities, null, 2));
  console.log('Sources in DB:', JSON.stringify(sources, null, 2));
  console.log('Customers with VIB source:', customersWithVib);
  const addCount = await prisma.customer.count({ where: { address: { not: null } } });
  const noteCount = await prisma.customer.count({ where: { note: { not: null } } });
  const fuCount = await prisma.followUp.count();
  const fuAssigned = await prisma.followUp.groupBy({ by: ['assignedTo'], _count: { _all: true } });
  console.log('Customers with address:', addCount);
  console.log('Customers with note:', noteCount);
  console.log('Follow-ups count:', fuCount);
  const sample = await prisma.customer.findMany({
    where: { OR: [{ address: { not: null } }, { note: { not: null } }] },
    take: 5,
    select: { id: true, fullName: true, address: true, note: true },
  });
  console.log('Sample address/note records:', JSON.stringify(sample, null, 2));
}

run()
  .catch((e) => {
    console.error('Inspection failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runReconciliation() {
  console.log('========================================================================');
  console.log('=== KTEA CRM PHASE 5: DATA RECONCILIATION & DEEP INTEGRITY AUDIT ===');
  console.log('========================================================================\n');

  await prisma.user.deleteMany({
    where: {
      email: { startsWith: 'admin_p5_' }
    }
  });

  // 1. Basic Counts
  const [
    customerCount,
    followUpCount,
    caretakerCount,
    userCount,
    caseCount,
    grantsCount,
    assignmentsCount,
    activityCount,
    needCount,
    noteCount,
    recommendationCount,
    pushRecordCount
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.followUp.count(),
    prisma.caretaker.count(),
    prisma.user.count(),
    prisma.customerCase.count(),
    prisma.customerAssignmentGrant.count(),
    prisma.customerAssignment.count(),
    prisma.customerActivity.count(),
    prisma.customerNeed.count(),
    prisma.customerNote.count(),
    prisma.recommendation.count(),
    prisma.pushRecord.count()
  ]);

  console.log('--- 1. OVERALL RECORD COUNTS ---');
  console.log(`- Customers:            ${customerCount} (Baseline Phase 0: 501)`);
  console.log(`- Follow-ups (Schedules):${followUpCount} (Baseline Phase 0: 140)`);
  console.log(`- Caretakers:           ${caretakerCount} (Baseline Phase 0: 6)`);
  console.log(`- Users:                ${userCount} (Baseline Phase 0: 8)`);

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, createdAt: true } });
  console.log('Current users:');
  users.forEach(u => console.log(`  - ${u.email} (${u.role}) [ID: ${u.id}]`));
  console.log(`- Loan Cases:           ${caseCount}`);
  console.log(`- Assignment Grants:    ${grantsCount}`);
  console.log(`- Materialized Assigns: ${assignmentsCount}`);
  console.log(`- Activities:           ${activityCount}`);
  console.log(`- Needs:                ${needCount}`);
  console.log(`- Notes:                ${noteCount}`);
  console.log(`- Recommendations:      ${recommendationCount}`);
  console.log(`- Push Records:         ${pushRecordCount}\n`);

  // 2. Caretakers Audit
  console.log('--- 2. CARETAKER ROSTER & MAPPING AUDIT ---');
  const caretakers = await prisma.caretaker.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true, status: true }
      }
    }
  });
  caretakers.forEach((c, idx) => {
    console.log(`[Caregiver ${idx + 1}] ID: ${c.id} | Name: "${c.name}" | Linked User: ${c.user ? `${c.user.email} (${c.user.role})` : 'UNLINKED'}`);
  });
  console.log('');

  // 3. Follow-up distribution by Caretaker
  console.log('--- 3. HISTORICAL CARE SCHEDULE (FOLLOW-UP) DISTRIBUTION ---');
  const followUpCaregiverDist = await prisma.followUp.groupBy({
    by: ['assignedTo'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  followUpCaregiverDist.forEach(group => {
    console.log(`- Caretaker "${group.assignedTo}": ${group._count.id} historical schedules`);
  });
  console.log('');

  // 4. Check for Orphan Records (Integrity Check)
  console.log('--- 4. FOREIGN KEY & ORPHAN INTEGRITY VERIFICATION ---');
  
  // Follow-ups without valid customer
  const followUps = await prisma.followUp.findMany({ select: { id: true, customerId: true } });
  const allCustomerIds = new Set((await prisma.customer.findMany({ select: { id: true } })).map(c => c.id));
  const orphanFollowUps = followUps.filter(f => !allCustomerIds.has(f.customerId));
  console.log(`- Orphan Follow-ups (no matching customer): ${orphanFollowUps.length}`);

  // Cases without valid customer
  const cases = await prisma.customerCase.findMany({ select: { id: true, customerId: true } });
  const orphanCases = cases.filter(c => !allCustomerIds.has(c.customerId));
  console.log(`- Orphan Cases (no matching customer): ${orphanCases.length}`);

  // Assignments without valid customer or user
  const allUserIds = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));
  const assignments = await prisma.customerAssignment.findMany({ select: { customerId: true, userId: true } });
  const orphanAssignments = assignments.filter(a => !allCustomerIds.has(a.customerId) || !allUserIds.has(a.userId));
  console.log(`- Orphan Assignments (no matching customer or user): ${orphanAssignments.length}`);

  // Grants without valid customer or user
  const grants = await prisma.customerAssignmentGrant.findMany({ select: { customerId: true, userId: true } });
  const orphanGrants = grants.filter(g => !allCustomerIds.has(g.customerId) || !allUserIds.has(g.userId));
  console.log(`- Orphan Grants (no matching customer or user): ${orphanGrants.length}`);

  // 5. Active Grants vs Materialized Assignment consistency
  console.log('\n--- 5. ASSIGNMENT GRANTS vs MATERIALIZED ASSIGNMENTS CONSISTENCY ---');
  const activeGrants = await prisma.customerAssignmentGrant.findMany({
    where: { active: true },
    select: { customerId: true, userId: true, sourceType: true }
  });
  const grantPairs = new Set(activeGrants.map(g => `${g.userId}::${g.customerId}`));
  const assignmentPairs = new Set(assignments.map(a => `${a.userId}::${a.customerId}`));

  let grantDiscrepancies = 0;
  for (const pair of grantPairs) {
    if (!assignmentPairs.has(pair)) {
      console.warn(`[WARNING] Active grant exists but missing from customer_assignments: ${pair}`);
      grantDiscrepancies++;
    }
  }
  for (const pair of assignmentPairs) {
    if (!grantPairs.has(pair)) {
      // Direct legacy assignment without grant or grant missing
      console.log(`[INFO] Materialized assignment present (legacy/direct): ${pair}`);
    }
  }
  console.log(`- Total active grant pairs: ${grantPairs.size}`);
  console.log(`- Total materialized assignment pairs: ${assignmentPairs.size}`);
  console.log(`- Missing materialized assignments from active grants: ${grantDiscrepancies}`);

  console.log('\n--- 6. PRISMA MIGRATIONS TABLE AUDIT ---');
  try {
    const migrations: any[] = await prisma.$queryRawUnsafe('SELECT id, migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC');
    console.log('Applied migrations in database:');
    migrations.forEach(m => console.log(`  - [${m.finished_at ? 'APPLIED' : 'PENDING'}] ${m.migration_name}`));
  } catch (err: any) {
    console.warn('Could not query _prisma_migrations:', err.message);
  }

  // Check information_schema columns for caretakers
  try {
    const caretakerCols: any[] = await prisma.$queryRawUnsafe(
      "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'caretakers'"
    );
    console.log('\nColumns in caretakers table:');
    caretakerCols.forEach(c => console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE}, nullable: ${c.IS_NULLABLE})`));
  } catch (err: any) {
    console.warn('Could not query information_schema:', err.message);
  }

  console.log('\n========================================================================');
  if (customerCount === 501 && followUpCount === 140 && caretakerCount === 6 && orphanFollowUps.length === 0 && orphanCases.length === 0) {
    console.log('✅ RECONCILIATION RESULT: 100% PERFECT MATCH WITH PHASE 0 BASELINE!');
  } else {
    console.warn('⚠️ RECONCILIATION RESULT: Some metrics differ from exact initial baseline. Check details above.');
  }
  console.log('========================================================================\n');
}

runReconciliation()
  .catch(err => {
    console.error('Reconciliation error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

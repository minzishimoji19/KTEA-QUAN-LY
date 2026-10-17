import { PrismaClient, AssignmentSourceType } from '@prisma/client';

const prisma = new PrismaClient();

const USER_MAPPING_BY_NAME: Record<string, string> = {
  'Lê Na': '5a8fdfb3-4feb-4a11-8cd8-d28b8b3d1825',
  'Phước Tuấn': '120e93b5-a3e9-46ff-8f1d-54050d84c468',
  'Minh Tâm': 'dbf6b39c-3874-4cf7-9cdc-e6c69b45a883',
  'Ktea': '1b1f9629-4c5d-4f20-bbd5-46cc07709c78',
  'xoaicaldez': '2751b179-bbfe-4147-aef7-d48d8be3293b',
};

async function main() {
  console.log('--- STARTING PHASE 3 HISTORICAL DATA MIGRATION ---');

  // 1. Baseline verification
  const totalUsersBefore = await prisma.user.count();
  const totalCustomersBefore = await prisma.customer.count();
  const totalCasesBefore = await prisma.customerCase.count();
  const totalFollowUpsBefore = await prisma.followUp.count();
  const totalAssignmentsBefore = await prisma.customerAssignment.count();
  const totalGrantsBefore = await prisma.customerAssignmentGrant.count();

  console.log('BASELINE BEFORE MIGRATION:');
  console.log(`- Users: ${totalUsersBefore}`);
  console.log(`- Customers: ${totalCustomersBefore}`);
  console.log(`- Customer Cases: ${totalCasesBefore}`);
  console.log(`- FollowUps: ${totalFollowUpsBefore}`);
  console.log(`- Customer Assignments: ${totalAssignmentsBefore}`);
  console.log(`- Customer Assignment Grants: ${totalGrantsBefore}`);

  // 2. Fetch all follow-ups
  const followUps = await prisma.followUp.findMany({
    select: {
      id: true,
      customerId: true,
      assignedTo: true,
      assignedToUserId: true,
    },
  });

  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, role: true, status: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  let updatedFollowUpCount = 0;
  let skippedFollowUpCount = 0;
  let unmappedCount = 0;
  let grantsCreatedCount = 0;
  let assignmentsCreatedCount = 0;

  for (const fu of followUps) {
    const rawAssignedTo = fu.assignedTo?.trim() || '';
    const mappedUserId = USER_MAPPING_BY_NAME[rawAssignedTo];

    if (!mappedUserId) {
      console.log(`[UNMAPPED] FollowUp ID: ${fu.id}, assignedTo: "${fu.assignedTo}" -> Kept assigned_to_user_id as null`);
      unmappedCount++;
      continue;
    }

    const targetUser = userMap.get(mappedUserId);
    if (!targetUser) {
      console.error(`[ERROR] Target user ID ${mappedUserId} not found in database!`);
      continue;
    }

    // Update FollowUp assignedToUserId if different
    if (fu.assignedToUserId !== mappedUserId) {
      await prisma.followUp.update({
        where: { id: fu.id },
        data: {
          assignedToUserId: mappedUserId,
        },
      });
      updatedFollowUpCount++;
    } else {
      skippedFollowUpCount++;
    }

    // If target user is a PARTNER, synchronize grants and assignments
    if (targetUser.role === 'PARTNER' && targetUser.status === 'ACTIVE') {
      const existingGrant = await prisma.customerAssignmentGrant.findUnique({
        where: {
          customer_user_source_unique: {
            customerId: fu.customerId,
            userId: mappedUserId,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: fu.id,
          },
        },
      });

      if (!existingGrant) {
        await prisma.customerAssignmentGrant.create({
          data: {
            customerId: fu.customerId,
            userId: mappedUserId,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: fu.id,
            active: true,
            notes: `Auto-backfilled from care schedule ${fu.id}`,
          },
        });
        grantsCreatedCount++;
      }

      // Upsert into customer_assignments materialized table
      const existingAssignment = await prisma.customerAssignment.findUnique({
        where: {
          customerId_userId: {
            customerId: fu.customerId,
            userId: mappedUserId,
          },
        },
      });

      if (!existingAssignment) {
        await prisma.customerAssignment.create({
          data: {
            customerId: fu.customerId,
            userId: mappedUserId,
            notes: `Assigned via care schedule grant`,
          },
        });
        assignmentsCreatedCount++;
      }
    }
  }

  // 3. Verification after migration
  const totalUsersAfter = await prisma.user.count();
  const totalCustomersAfter = await prisma.customer.count();
  const totalCasesAfter = await prisma.customerCase.count();
  const totalFollowUpsAfter = await prisma.followUp.count();
  const totalAssignmentsAfter = await prisma.customerAssignment.count();
  const totalGrantsAfter = await prisma.customerAssignmentGrant.count();

  const followUpsWithUser = await prisma.followUp.count({
    where: { assignedToUserId: { not: null } },
  });
  const followUpsWithoutUser = await prisma.followUp.count({
    where: { assignedToUserId: null },
  });

  console.log('\n--- MIGRATION RESULTS ---');
  console.log(`- Updated FollowUps assigned_to_user_id: ${updatedFollowUpCount}`);
  console.log(`- Already updated / skipped: ${skippedFollowUpCount}`);
  console.log(`- Unmapped FollowUps kept as null: ${unmappedCount}`);
  console.log(`- FollowUps with assignedToUserId: ${followUpsWithUser}`);
  console.log(`- FollowUps without assignedToUserId: ${followUpsWithoutUser}`);
  console.log(`- Assignment Grants created: ${grantsCreatedCount}`);
  console.log(`- New Customer Assignments created: ${assignmentsCreatedCount}`);

  console.log('\n--- VERIFICATION AGAINST BASELINE ---');
  console.log(`- Users: ${totalUsersBefore} -> ${totalUsersAfter} (Delta: ${totalUsersAfter - totalUsersBefore})`);
  console.log(`- Customers: ${totalCustomersBefore} -> ${totalCustomersAfter} (Delta: ${totalCustomersAfter - totalCustomersBefore})`);
  console.log(`- Customer Cases: ${totalCasesBefore} -> ${totalCasesAfter} (Delta: ${totalCasesAfter - totalCasesBefore})`);
  console.log(`- FollowUps: ${totalFollowUpsBefore} -> ${totalFollowUpsAfter} (Delta: ${totalFollowUpsAfter - totalFollowUpsBefore})`);
  console.log(`- Customer Assignments: ${totalAssignmentsBefore} -> ${totalAssignmentsAfter} (Delta: +${totalAssignmentsAfter - totalAssignmentsBefore})`);
  console.log(`- Customer Assignment Grants: ${totalGrantsBefore} -> ${totalGrantsAfter} (Delta: +${totalGrantsAfter - totalGrantsBefore})`);

  if (
    totalUsersBefore !== totalUsersAfter ||
    totalCustomersBefore !== totalCustomersAfter ||
    totalCasesBefore !== totalCasesAfter ||
    totalFollowUpsBefore !== totalFollowUpsAfter
  ) {
    throw new Error('FATAL: Core business data count mismatch after migration!');
  }

  console.log('\nSUCCESS: Phase 3 migration finished with 100% data preservation!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

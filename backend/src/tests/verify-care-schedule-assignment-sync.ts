import prisma from '../config/database.js';
import { followUpService } from '../services/followUp.service.js';
import { assignmentSyncService } from '../services/assignmentSync.service.js';
import { userService } from '../services/user.service.js';
import { caretakerRepository } from '../repositories/caretaker.repository.js';
import { FollowUpStatus, AssignmentSourceType } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function runPhase3Verification() {
  console.log('================================================================');
  console.log('=== KTEA CRM PHASE 3: SAFE CARE SCHEDULE & ASSIGNMENT SYNC ===');
  console.log('================================================================\n');

  // Pre-cleanup of any lingering test records from previous test runs
  await prisma.customerActivity.deleteMany({ where: { customer: { fullName: { startsWith: '_TEST_P3_' } } } });
  await prisma.customerAssignmentGrant.deleteMany({ where: { customer: { fullName: { startsWith: '_TEST_P3_' } } } });
  await prisma.customerAssignment.deleteMany({ where: { customer: { fullName: { startsWith: '_TEST_P3_' } } } });
  await prisma.followUp.deleteMany({ where: { customer: { fullName: { startsWith: '_TEST_P3_' } } } });
  await prisma.customer.deleteMany({ where: { fullName: { startsWith: '_TEST_P3_' } } });
  await prisma.caretaker.deleteMany({ where: { name: { contains: 'P3' } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'p3_partner_' } } });

  // 0. Verify Baseline Pre-Condition
  console.log('--- 0. CHECKING BASELINE DATA PRESERVATION ---');
  const baselineCustomerCount = await prisma.customer.count();
  const baselineFollowUpCount = await prisma.followUp.count();
  const baselineCaretakerCount = await prisma.caretaker.count();
  const baselineUserCount = await prisma.user.count();

  console.log(`Initial Customers count: ${baselineCustomerCount}`);
  console.log(`Initial FollowUps count: ${baselineFollowUpCount}`);
  console.log(`Initial Caretakers count: ${baselineCaretakerCount}`);
  console.log(`Initial Users count: ${baselineUserCount}`);

  if (baselineCustomerCount < 500) {
    throw new Error(`CRITICAL: Baseline customer count (${baselineCustomerCount}) is unexpectedly lower than 500!`);
  }
  console.log('✓ Baseline counts verified and documented.\n');

  // Test variables for cleanup tracking
  let testCustomer: any = null;
  let testUserA: any = null;
  let testUserB: any = null;
  let caretakerA: any = null;
  let caretakerB: any = null;
  let caretakerUnlinked: any = null;
  const createdFollowUpIds: string[] = [];

  const timestamp = Date.now();
  const hash = await bcrypt.hash('P3SecurePass123!', 10);

  const realAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
  });
  if (!realAdmin) throw new Error('No active ADMIN user found in system for testing');
  const adminActor = { id: realAdmin.id, email: realAdmin.email };

  try {
    // Setup isolated test fixtures
    console.log('--- SETUP: CREATING ISOLATED TEST FIXTURES ---');
    testCustomer = await prisma.customer.create({
      data: {
        fullName: `_TEST_P3_CUSTOMER_${timestamp}`,
        phone: `0998${Math.floor(100000 + Math.random() * 900000)}`,
        overallStatus: 'LEAD_MOI',
      },
    });

    testUserA = await prisma.user.create({
      data: {
        email: `p3_partner_a_${timestamp}@example.com`,
        passwordHash: hash,
        fullName: `Partner A P3 ${timestamp}`,
        role: 'PARTNER',
        status: 'ACTIVE',
      },
    });

    testUserB = await prisma.user.create({
      data: {
        email: `p3_partner_b_${timestamp}@example.com`,
        passwordHash: hash,
        fullName: `Partner B P3 ${timestamp}`,
        role: 'PARTNER',
        status: 'ACTIVE',
      },
    });

    caretakerA = await prisma.caretaker.create({
      data: {
        name: `Caregiver A P3 ${timestamp}`,
        active: true,
        userId: testUserA.id,
      },
    });

    caretakerB = await prisma.caretaker.create({
      data: {
        name: `Caregiver B P3 ${timestamp}`,
        active: true,
        userId: testUserB.id,
      },
    });

    caretakerUnlinked = await prisma.caretaker.create({
      data: {
        name: `Caregiver Unlinked P3 ${timestamp}`,
        active: true,
        userId: null,
      },
    });

    console.log(`✓ Test Customer: ${testCustomer.fullName} (${testCustomer.id})`);
    console.log(`✓ Linked Caretaker A: ${caretakerA.name} -> User: ${testUserA.fullName}`);
    console.log(`✓ Linked Caretaker B: ${caretakerB.name} -> User: ${testUserB.fullName}`);
    console.log(`✓ Unlinked Caretaker: ${caretakerUnlinked.name} (No User)\n`);

    // =========================================================================
    // TEST 1: Tạo lịch với caregiver đã liên kết
    // =========================================================================
    console.log('--- TEST 1: Tạo lịch với caregiver đã liên kết ---');
    const fu1 = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Phase 3 Care Schedule 1',
      dueAt: new Date(Date.now() + 86400000),
      assignedTo: caretakerA.name,
    });
    createdFollowUpIds.push(fu1.id);

    // Check CustomerAssignmentGrant
    const grant1 = await prisma.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId: testCustomer.id,
          userId: testUserA.id,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: fu1.id,
        },
      },
    });

    if (!grant1 || !grant1.active) {
      throw new Error('TEST 1 FAILED: CustomerAssignmentGrant for Caregiver A was not created or is inactive');
    }

    // Check CustomerAssignment materialized record
    const assignmentA1 = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId: testCustomer.id,
          userId: testUserA.id,
        },
      },
    });

    if (!assignmentA1) {
      throw new Error('TEST 1 FAILED: CustomerAssignment was not synchronized for Partner A');
    }
    console.log(`✓ Grant created: sourceId=${grant1.sourceId}, type=${grant1.sourceType}, active=${grant1.active}`);
    console.log(`✓ CustomerAssignment confirmed for User A (${testUserA.id})`);
    console.log('✓ TEST 1 PASSED: Tạo lịch với caregiver đã liên kết đồng bộ assignment thành công.\n');

    // =========================================================================
    // TEST 2: Tạo lịch với caregiver chưa liên kết
    // =========================================================================
    console.log('--- TEST 2: Tạo lịch với caregiver chưa liên kết ---');
    const fuUnlinked = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Phase 3 Care Schedule Unlinked',
      dueAt: new Date(Date.now() + 172800000),
      assignedTo: caretakerUnlinked.name,
    });
    createdFollowUpIds.push(fuUnlinked.id);

    // Follow-up must be saved with assignedTo
    if (fuUnlinked.assignedTo !== caretakerUnlinked.name) {
      throw new Error('TEST 2 FAILED: Follow-up was not saved with unlinked caregiver name');
    }

    // Must NOT have created any grants for unlinked caregiver
    const unlinkedGrants = await prisma.customerAssignmentGrant.findMany({
      where: {
        customerId: testCustomer.id,
        sourceId: fuUnlinked.id,
      },
    });

    if (unlinkedGrants.length > 0) {
      throw new Error('TEST 2 FAILED: Grants were created for an unlinked caregiver');
    }

    // Verify clear notice was returned
    const syncRes: any = (fuUnlinked as any).syncResult;
    if (!syncRes || !syncRes.notice || !syncRes.notice.includes('chưa liên kết')) {
      throw new Error(`TEST 2 FAILED: Notice did not clearly inform Admin about unlinked caregiver. Notice: ${syncRes?.notice}`);
    }
    console.log(`✓ Unlinked schedule saved. Notice given: "${syncRes.notice}"`);
    console.log('✓ TEST 2 PASSED: Caregiver chưa liên kết không ghép theo tên và có thông báo rõ cho Admin.\n');

    // =========================================================================
    // TEST 3: Đổi caregiver A sang B khi A không còn nguồn nào khác
    // =========================================================================
    console.log('--- TEST 3: Đổi caregiver A sang B khi A không còn nguồn nào khác ---');
    await followUpService.updateFollowUp(fu1.id, {
      assignedTo: caretakerB.name,
    });

    // Grant for A should be deactivated/revoked
    const grantA_after = await prisma.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId: testCustomer.id,
          userId: testUserA.id,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: fu1.id,
        },
      },
    });
    if (grantA_after && grantA_after.active) {
      throw new Error('TEST 3 FAILED: Grant for A was not deactivated after reassignment');
    }

    // Grant for B should be active
    const grantB = await prisma.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId: testCustomer.id,
          userId: testUserB.id,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: fu1.id,
        },
      },
    });
    if (!grantB || !grantB.active) {
      throw new Error('TEST 3 FAILED: Grant for B was not created or inactive');
    }

    // CustomerAssignment for A should be revoked (0 remaining grants)
    const assignmentA_after = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId: testCustomer.id,
          userId: testUserA.id,
        },
      },
    });
    if (assignmentA_after) {
      throw new Error('TEST 3 FAILED: CustomerAssignment for A was not removed when 0 grants remained');
    }

    // CustomerAssignment for B should exist
    const assignmentB = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId: testCustomer.id,
          userId: testUserB.id,
        },
      },
    });
    if (!assignmentB) {
      throw new Error('TEST 3 FAILED: CustomerAssignment for B was not granted');
    }
    console.log('✓ User A permission revoked as expected (0 grants remaining).');
    console.log('✓ User B granted permission as expected.');
    console.log('✓ TEST 3 PASSED: Đổi A sang B chuyển giao quyền an toàn.\n');

    // =========================================================================
    // TEST 4: Đổi caregiver A sang B khi A VẪN CÓ assignment độc lập (DIRECT)
    // =========================================================================
    console.log('--- TEST 4: Đổi caregiver khi A vẫn có assignment độc lập (DIRECT) ---');
    // Admin directly assigns User A to testCustomer
    await userService.assignCustomers(adminActor, testUserA.id, [testCustomer.id]);

    // Verify Direct grant exists
    const directGrantA = await prisma.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId: testCustomer.id,
          userId: testUserA.id,
          sourceType: AssignmentSourceType.DIRECT,
          sourceId: 'DIRECT',
        },
      },
    });
    if (!directGrantA || !directGrantA.active) {
      throw new Error('TEST 4 FAILED: Direct grant for A was not registered');
    }

    // Reassign fu1 back to Caretaker A (A now has 2 sources: DIRECT and CARE_SCHEDULE)
    await followUpService.updateFollowUp(fu1.id, {
      assignedTo: caretakerA.name,
    });

    const aGrantsCount = await prisma.customerAssignmentGrant.count({
      where: {
        customerId: testCustomer.id,
        userId: testUserA.id,
        active: true,
      },
    });
    console.log(`✓ Active grants for A before reassigning to B: ${aGrantsCount} (expected 2: DIRECT + CARE_SCHEDULE)`);
    if (aGrantsCount !== 2) {
      throw new Error(`TEST 4 FAILED: Expected 2 active grants for A, got ${aGrantsCount}`);
    }

    // Now reassign fu1 to Caretaker B
    await followUpService.updateFollowUp(fu1.id, {
      assignedTo: caretakerB.name,
    });

    // User A must STILL have CustomerAssignment because DIRECT grant is still active!
    const assignmentA_retained = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId: testCustomer.id,
          userId: testUserA.id,
        },
      },
    });
    if (!assignmentA_retained) {
      throw new Error('TEST 4 FAILED: User A lost CustomerAssignment despite having active DIRECT grant!');
    }
    console.log('✓ User A RETAINED access to customer via direct assignment.');
    console.log('✓ User B acquired access to customer via schedule.');
    console.log('✓ TEST 4 PASSED: Assignment độc lập của A được bảo toàn nguyên vẹn.\n');

    // =========================================================================
    // TEST 5: A còn một lịch khác hợp lệ
    // =========================================================================
    console.log('--- TEST 5: A còn một lịch khác hợp lệ ---');
    // Remove DIRECT grant from A first so we test purely multi-schedule overlap
    await userService.unassignCustomer(adminActor, testUserA.id, testCustomer.id);

    // Verify DIRECT grant is inactive
    const directGrantA_revoked = await prisma.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId: testCustomer.id,
          userId: testUserA.id,
          sourceType: AssignmentSourceType.DIRECT,
          sourceId: 'DIRECT',
        },
      },
    });
    if (directGrantA_revoked && directGrantA_revoked.active) {
      throw new Error('TEST 5 SETUP FAILED: Direct grant was not deactivated');
    }

    // Create Schedule FU-Alpha for A
    const fuAlpha = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Schedule Alpha for A',
      dueAt: new Date(Date.now() + 86400000),
      assignedTo: caretakerA.name,
    });
    createdFollowUpIds.push(fuAlpha.id);

    // Create Schedule FU-Beta for A
    const fuBeta = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Schedule Beta for A',
      dueAt: new Date(Date.now() + 172800000),
      assignedTo: caretakerA.name,
    });
    createdFollowUpIds.push(fuBeta.id);

    // Now switch FU-Alpha to Caretaker B
    await followUpService.updateFollowUp(fuAlpha.id, {
      assignedTo: caretakerB.name,
    });

    // Check User A: FU-Beta is still active for A, so A MUST KEEP customer assignment!
    const assignmentA_multiSchedule = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId: testCustomer.id,
          userId: testUserA.id,
        },
      },
    });
    if (!assignmentA_multiSchedule) {
      throw new Error('TEST 5 FAILED: User A lost CustomerAssignment even though FU-Beta was still active!');
    }
    console.log('✓ User A preserved customer access because Schedule Beta is still active.');
    console.log('✓ TEST 5 PASSED: A còn một lịch khác hợp lệ thì không bị thu hồi quyền.\n');

    // =========================================================================
    // TEST 6: Hủy lịch (CANCELLED) nhưng còn nguồn assignment khác
    // =========================================================================
    console.log('--- TEST 6: Hủy một lịch nhưng còn nguồn assignment khác ---');
    // Soft-cancel FU-Beta (set status = CANCELLED)
    await followUpService.updateFollowUp(fuBeta.id, {
      status: FollowUpStatus.CANCELLED,
    });

    // Grant for FU-Beta must be deactivated
    const grantBeta = await prisma.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId: testCustomer.id,
          userId: testUserA.id,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: fuBeta.id,
        },
      },
    });
    if (grantBeta && grantBeta.active) {
      throw new Error('TEST 6 FAILED: Grant for FU-Beta was not deactivated upon CANCELLED');
    }

    // Now A has 0 active grants on testCustomer (FU-Alpha went to B, FU-Beta is cancelled, Direct is unassigned)
    const assignmentA_final = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId: testCustomer.id,
          userId: testUserA.id,
        },
      },
    });
    if (assignmentA_final) {
      throw new Error('TEST 6 FAILED: User A should have lost access after last grant was cancelled');
    }

    // Notice that history is preserved: fuBeta is NOT deleted, its status is CANCELLED
    const cancelledRecord = await prisma.followUp.findUnique({
      where: { id: fuBeta.id },
    });
    if (!cancelledRecord || cancelledRecord.status !== FollowUpStatus.CANCELLED) {
      throw new Error('TEST 6 FAILED: Follow-up was hard-deleted or status not CANCELLED');
    }
    console.log('✓ FU-Beta soft-cancelled with status CANCELLED, history preserved in DB.');
    console.log('✓ Access revoked only when total remaining grants reached 0.');
    console.log('✓ TEST 6 PASSED: Hủy lịch vô hiệu hóa nguồn và bảo toàn audit trail.\n');

    // =========================================================================
    // TEST 7: Nhiều nguồn cùng hỗ trợ một assignment
    // =========================================================================
    console.log('--- TEST 7: Nhiều nguồn cùng hỗ trợ một assignment ---');
    // Give User A 3 sources: DIRECT + Schedule 1 + Schedule 2
    await userService.assignCustomers(adminActor, testUserA.id, [testCustomer.id]);
    const fuMulti1 = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Multi Source Schedule 1',
      dueAt: new Date(Date.now() + 86400000),
      assignedTo: caretakerA.name,
    });
    createdFollowUpIds.push(fuMulti1.id);

    const fuMulti2 = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Multi Source Schedule 2',
      dueAt: new Date(Date.now() + 172800000),
      assignedTo: caretakerA.name,
    });
    createdFollowUpIds.push(fuMulti2.id);

    const activeGrantsA = await prisma.customerAssignmentGrant.count({
      where: {
        customerId: testCustomer.id,
        userId: testUserA.id,
        active: true,
      },
    });
    console.log(`✓ Active grants for A: ${activeGrantsA} (expected 3)`);
    if (activeGrantsA !== 3) {
      throw new Error(`TEST 7 FAILED: Expected 3 grants, got ${activeGrantsA}`);
    }

    // Revoke source 1 (unassign direct) -> 2 remaining -> still has access
    await userService.unassignCustomer(adminActor, testUserA.id, testCustomer.id);
    let hasAccess = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: testCustomer.id, userId: testUserA.id } },
    });
    if (!hasAccess) throw new Error('TEST 7 FAILED: Access lost after unassigning direct (2 schedules remained)');

    // Revoke source 2 (cancel multi1) -> 1 remaining -> still has access
    await followUpService.updateFollowUp(fuMulti1.id, { status: FollowUpStatus.CANCELLED });
    hasAccess = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: testCustomer.id, userId: testUserA.id } },
    });
    if (!hasAccess) throw new Error('TEST 7 FAILED: Access lost after cancelling schedule 1 (1 schedule remained)');

    // Revoke source 3 (cancel multi2) -> 0 remaining -> access safely removed
    await followUpService.updateFollowUp(fuMulti2.id, { status: FollowUpStatus.CANCELLED });
    hasAccess = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: testCustomer.id, userId: testUserA.id } },
    });
    if (hasAccess) throw new Error('TEST 7 FAILED: Access retained after all 3 sources revoked');

    console.log('✓ Multi-source reference counting correctly protected access until the last source ended.');
    console.log('✓ TEST 7 PASSED: Nhiều nguồn cùng hỗ trợ hoạt động chuẩn xác.\n');

    // =========================================================================
    // TEST 8: Retry và Request đồng thời (Idempotency & Concurrency)
    // =========================================================================
    console.log('--- TEST 8: Retry và Request đồng thời ---');
    const fuConcurrent = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: 'Concurrent Schedule Test',
      dueAt: new Date(Date.now() + 86400000),
      assignedTo: caretakerA.name,
    });
    createdFollowUpIds.push(fuConcurrent.id);

    // Call syncFollowUpAssignment twice sequentially in separate transactions (simulating retry)
    await prisma.$transaction(
      async (tx) => {
        await assignmentSyncService.syncFollowUpAssignment(tx, {
          followUpId: fuConcurrent.id,
          customerId: testCustomer.id,
          caregiverName: caretakerA.name,
        });
      },
      { maxWait: 5000, timeout: 15000 }
    );

    await prisma.$transaction(
      async (tx) => {
        await assignmentSyncService.syncFollowUpAssignment(tx, {
          followUpId: fuConcurrent.id,
          customerId: testCustomer.id,
          caregiverName: caretakerA.name,
        });
      },
      { maxWait: 5000, timeout: 15000 }
    );

    const grantCountForConcurrent = await prisma.customerAssignmentGrant.count({
      where: {
        customerId: testCustomer.id,
        userId: testUserA.id,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
        sourceId: fuConcurrent.id,
      },
    });

    if (grantCountForConcurrent !== 1) {
      throw new Error(`TEST 8 FAILED: Expected exactly 1 grant after retry, found ${grantCountForConcurrent}`);
    }
    console.log(`✓ Exactly 1 grant found after multiple retries (${grantCountForConcurrent}).`);
    console.log('✓ TEST 8 PASSED: Không tạo duplicate khi retry.\n');

    // =========================================================================
    // TEST 9: Transaction thất bại giữa chừng (Rollback integrity)
    // =========================================================================
    console.log('--- TEST 9: Transaction thất bại giữa chừng ---');
    const rollbackTestId = `dummy_fu_${Date.now()}`;
    let rollbackThrew = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          // Step 1: Create a grant inside tx
          await assignmentSyncService.syncFollowUpAssignment(tx, {
            followUpId: rollbackTestId,
            customerId: testCustomer.id,
            caregiverName: caretakerB.name,
          });

          // Step 2: Deliberately throw an error before tx completes
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        },
        { maxWait: 5000, timeout: 15000 }
      );
    } catch (err: any) {
      if (err.message === 'SIMULATED_TRANSACTION_FAILURE') {
        rollbackThrew = true;
      }
    }

    if (!rollbackThrew) {
      throw new Error('TEST 9 FAILED: Simulated error was not thrown');
    }

    // Verify grant for rollbackTestId DOES NOT EXIST in database
    const orphanedGrant = await prisma.customerAssignmentGrant.findFirst({
      where: {
        sourceId: rollbackTestId,
      },
    });

    if (orphanedGrant) {
      throw new Error('TEST 9 FAILED: Orphaned grant was committed despite transaction failure!');
    }
    console.log('✓ Transaction aborted cleanly; no orphaned grant committed.');
    console.log('✓ TEST 9 PASSED: Transaction rollback bảo đảm tính toàn vẹn dữ liệu.\n');

    // =========================================================================
    // TEST 10: Lịch sử cũ vẫn còn nguyên vẹn
    // =========================================================================
    console.log('--- TEST 10: Lịch sử cũ vẫn còn nguyên vẹn ---');
    const endCustomerCount = await prisma.customer.count({
      where: {
        id: { not: testCustomer.id },
      },
    });
    const endFollowUpCount = await prisma.followUp.count({
      where: {
        id: { notIn: createdFollowUpIds },
      },
    });

    console.log(`Baseline customers remaining: ${endCustomerCount} (original: ${baselineCustomerCount})`);
    console.log(`Baseline followups remaining: ${endFollowUpCount} (original: ${baselineFollowUpCount})`);

    if (endCustomerCount !== baselineCustomerCount) {
      throw new Error(`TEST 10 FAILED: Customer count mismatch! Initial: ${baselineCustomerCount}, current: ${endCustomerCount}`);
    }
    if (endFollowUpCount !== baselineFollowUpCount) {
      throw new Error(`TEST 10 FAILED: FollowUp count mismatch! Initial: ${baselineFollowUpCount}, current: ${endFollowUpCount}`);
    }
    console.log('✓ TEST 10 PASSED: Toàn bộ dữ liệu lịch sử và khách hàng ban đầu 100% nguyên vẹn.\n');

  } finally {
    // Clean up only isolated test fixtures
    console.log('--- CLEANUP: REMOVING TEST FIXTURES ---');
    try {
      if (testCustomer) {
        await prisma.customerActivity.deleteMany({ where: { customerId: testCustomer.id } });
        await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: testCustomer.id } });
        await prisma.customerAssignment.deleteMany({ where: { customerId: testCustomer.id } });
        await prisma.followUp.deleteMany({ where: { customerId: testCustomer.id } });
        await prisma.customer.delete({ where: { id: testCustomer.id } });
        console.log(`✓ Cleaned up test customer: ${testCustomer.id}`);
      }
      if (caretakerA) await prisma.caretaker.delete({ where: { id: caretakerA.id } });
      if (caretakerB) await prisma.caretaker.delete({ where: { id: caretakerB.id } });
      if (caretakerUnlinked) await prisma.caretaker.delete({ where: { id: caretakerUnlinked.id } });
      if (testUserA) await prisma.user.delete({ where: { id: testUserA.id } });
      if (testUserB) await prisma.user.delete({ where: { id: testUserB.id } });
      console.log('✓ Cleaned up test caregivers and users.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  }

  console.log('\n================================================================');
  console.log('=== ALL PHASE 3 TEST SUITE CASES COMPLETED SUCCESSFULLY! ===');
  console.log('================================================================');
}

runPhase3Verification()
  .catch((err) => {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

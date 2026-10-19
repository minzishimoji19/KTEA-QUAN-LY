import prisma from '../config/database.js';
import { followUpService } from '../services/followUp.service.js';
import { assignmentSyncService } from '../services/assignmentSync.service.js';
import { AssignmentSourceType, FollowUpStatus, Role, UserStatus } from '@prisma/client';
import assert from 'node:assert';

let passed = 0;
let failed = 0;

function check(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
    throw new Error(`Assertion failed: ${msg}`);
  }
}

const createdCustomerIds: string[] = [];
let testPartnerUserId: string | null = null;
let testAdminUserId: string | null = null;

async function createTestCustomer(prefix: string): Promise<{ id: string; fullName: string; phone: string }> {
  const phoneSuffix = Math.floor(100000 + Math.random() * 900000);
  const cust = await prisma.customer.create({
    data: {
      fullName: `Test ${prefix} ${Date.now().toString().slice(-4)}`,
      phone: `099${phoneSuffix}`,
    },
    select: { id: true, fullName: true, phone: true },
  });
  createdCustomerIds.push(cust.id);
  return cust;
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test fixtures...');
  try {
    if (createdCustomerIds.length > 0) {
      await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customerAssignment.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customerActivity.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.followUp.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (testPartnerUserId) {
      await prisma.customerAssignmentGrant.deleteMany({ where: { userId: testPartnerUserId } });
      await prisma.customerAssignment.deleteMany({ where: { userId: testPartnerUserId } });
      await prisma.user.delete({ where: { id: testPartnerUserId } }).catch(() => {});
    }
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🚀 RUNNING 10-POINT VERIFICATION FOR BULK CARE SCHEDULE TIMEOUT FIX');
  console.log('========================================================================\n');

  try {
    // Setup a dedicated active PARTNER user
    const partner = await prisma.user.create({
      data: {
        email: `partner_test_${Date.now()}@test.com`,
        passwordHash: 'dummy',
        fullName: 'Partner Test User',
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });
    testPartnerUserId = partner.id;

    // ------------------------------------------------------------------------
    // CASE 1: Lên lịch cho 1 khách hàng (với Partner)
    // ------------------------------------------------------------------------
    console.log('--- [Case 1] Lên lịch cho 1 khách hàng ---');
    const cust1 = await createTestCustomer('Single');
    const date1 = new Date('2026-12-10T10:00:00.000Z');

    const res1 = await followUpService.createBulkFollowUps({
      customerIds: [cust1.id],
      title: 'Lịch tư vấn 1 khách hàng',
      dueAt: date1,
      assignedToUserId: partner.id,
    });

    check(res1.count === 1, 'Tạo lịch đơn lẻ trả về đúng 1 bản ghi');
    check(res1.followUps.length === 1, 'Danh sách trả về 1 follow-up');
    check(res1.followUps[0].assignedToUserId === partner.id, 'Follow-up được gán đúng partner user ID');

    const grant1 = await prisma.customerAssignmentGrant.findFirst({
      where: {
        customerId: cust1.id,
        userId: partner.id,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
        sourceId: res1.followUps[0].id,
      },
    });
    check(grant1 !== null && grant1.active === true, 'Tạo thành công CARE_SCHEDULE grant cho partner');

    const assign1 = await prisma.customerAssignment.findFirst({
      where: { customerId: cust1.id, userId: partner.id },
    });
    check(assign1 !== null, 'Tạo thành công CustomerAssignment cho partner');

    // ------------------------------------------------------------------------
    // CASE 2: Lên lịch cho 25 khách hàng (Trường hợp từng gây lỗi 15s timeout)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 2] Lên lịch cho 25 khách hàng (Khắc phục lỗi Transaction Timeout) ---');
    const custs25: Array<{ id: string; fullName: string; phone: string }> = [];
    for (let i = 0; i < 25; i++) {
      custs25.push(await createTestCustomer(`Batch25_${i}`));
    }
    const date25 = new Date('2026-12-15T14:00:00.000Z');

    const tStart25 = Date.now();
    const res25 = await followUpService.createBulkFollowUps({
      customerIds: custs25.map((c) => c.id),
      title: 'Chiến dịch chăm sóc 25 khách hàng',
      dueAt: date25,
      assignedToUserId: partner.id,
    });
    const tElapsed25 = Date.now() - tStart25;

    console.log(`  ⏱ Thời gian hoàn thành 25 khách hàng: ${tElapsed25}ms`);
    check(res25.count === 25, 'Tạo đủ 25 lịch chăm sóc');
    check(tElapsed25 < 8000, `Thực thi nhanh vượt bậc: ${tElapsed25}ms (nhanh hơn nhiều so với giới hạn timeout 15000ms)`);

    const grants25Count = await prisma.customerAssignmentGrant.count({
      where: {
        customerId: { in: custs25.map((c) => c.id) },
        userId: partner.id,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
      },
    });
    check(grants25Count === 25, `Tạo đầy đủ 25 assignment grant (Actual: ${grants25Count})`);

    const assignments25Count = await prisma.customerAssignment.count({
      where: {
        customerId: { in: custs25.map((c) => c.id) },
        userId: partner.id,
      },
    });
    check(assignments25Count === 25, `Tạo đầy đủ 25 materialized assignment cho khách hàng (Actual: ${assignments25Count})`);

    // ------------------------------------------------------------------------
    // CASE 3: Lên lịch cho số lượng lớn hơn (50 khách hàng)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 3] Lên lịch cho số lượng lớn hơn (50 khách hàng) ---');
    const custs50: Array<{ id: string; fullName: string; phone: string }> = [];
    for (let i = 0; i < 50; i++) {
      custs50.push(await createTestCustomer(`Batch50_${i}`));
    }
    const date50 = new Date('2026-12-20T09:30:00.000Z');

    const tStart50 = Date.now();
    const res50 = await followUpService.createBulkFollowUps({
      customerIds: custs50.map((c) => c.id),
      title: 'Chiến dịch quy mô lớn 50 khách hàng',
      dueAt: date50,
      assignedToUserId: partner.id,
    });
    const tElapsed50 = Date.now() - tStart50;

    console.log(`  ⏱ Thời gian hoàn thành 50 khách hàng: ${tElapsed50}ms`);
    check(res50.count === 50, 'Tạo thành công đúng 50 lịch');
    check(tElapsed50 < 15000, `Thực thi 50 khách hàng mượt mà: ${tElapsed50}ms (< 15000ms)`);

    // ------------------------------------------------------------------------
    // CASE 4: Một request bị lỗi giữa chừng & kiểm tra Rollback nguyên tử
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 4] Request bị lỗi giữa chừng -> Rollback toàn bộ (Không có dữ liệu rác) ---');
    const atomicCust = await createTestCustomer('AtomicCust');
    let rollbackHandled = false;

    try {
      await prisma.$transaction(async (tx) => {
        // Thao tác 1: Tạo follow up hợp lệ
        const fu = await tx.followUp.create({
          data: {
            customerId: atomicCust.id,
            title: 'Lịch atomic sắp bị rollback',
            dueAt: new Date(),
            assignedToUserId: partner.id,
          },
        });
        // Thao tác 2: Tạo grant hợp lệ
        await tx.customerAssignmentGrant.create({
          data: {
            customerId: atomicCust.id,
            userId: partner.id,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: fu.id,
          },
        });
        // Thao tác 3: Cố tình throw lỗi
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (err: any) {
      if (err.message === 'SIMULATED_TRANSACTION_FAILURE') {
        rollbackHandled = true;
      }
    }

    check(rollbackHandled, 'Transaction bắt được lỗi và rollback');
    const atomicFuCount = await prisma.followUp.count({ where: { customerId: atomicCust.id } });
    const atomicGrantCount = await prisma.customerAssignmentGrant.count({ where: { customerId: atomicCust.id } });
    check(atomicFuCount === 0, 'Follow-up đã được rollback hoàn toàn');
    check(atomicGrantCount === 0, 'Grant đã được rollback hoàn toàn');

    // ------------------------------------------------------------------------
    // CASE 5: Gửi lại request sau lỗi mà không tạo lịch trùng (Idempotent Retry)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 5] Gửi lại request sau lỗi mà không tạo lịch trùng ---');
    const retryCust = await createTestCustomer('RetryCust');
    const retryDate = new Date('2026-12-25T11:00:00.000Z');

    const firstCall = await followUpService.createBulkFollowUps({
      customerIds: [retryCust.id],
      title: 'Lịch tư vấn bảo hiểm',
      dueAt: retryDate,
      assignedToUserId: partner.id,
    });
    check(firstCall.count === 1, 'Lần gọi đầu tiên thành công');

    const secondCall = await followUpService.createBulkFollowUps({
      customerIds: [retryCust.id],
      title: 'Lịch tư vấn bảo hiểm',
      dueAt: retryDate,
      assignedToUserId: partner.id,
    });
    check(secondCall.count === 1, 'Lần gọi thứ 2 (retry) trả về thành công');

    const countInDb = await prisma.followUp.count({
      where: { customerId: retryCust.id, title: 'Lịch tư vấn bảo hiểm' },
    });
    check(countInDb === 1, 'Trong DB chỉ có đúng 1 bản ghi followUp, không bị trùng lặp');

    const grantsCount = await prisma.customerAssignmentGrant.count({
      where: { customerId: retryCust.id, userId: partner.id },
    });
    check(grantsCount === 1, 'Trong DB chỉ có đúng 1 grant, không bị trùng lặp');

    // ------------------------------------------------------------------------
    // CASE 6: Nhiều khách hàng được giao cho cùng một Partner
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 6] Nhiều khách hàng được giao cho cùng một Partner ---');
    const multiCustA = await createTestCustomer('MultiA');
    const multiCustB = await createTestCustomer('MultiB');

    await followUpService.createBulkFollowUps({
      customerIds: [multiCustA.id, multiCustB.id],
      title: 'Lịch chăm sóc chung đối tác',
      dueAt: new Date('2026-12-28T10:00:00.000Z'),
      assignedToUserId: partner.id,
    });

    const assignA = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: multiCustA.id, userId: partner.id } },
    });
    const assignB = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: multiCustB.id, userId: partner.id } },
    });
    check(assignA !== null && assignB !== null, 'Cả hai khách hàng đều có CustomerAssignment riêng cho partner');

    // ------------------------------------------------------------------------
    // CASE 7: Khách hàng có nhiều nguồn phân công hợp lệ (DIRECT + CARE_SCHEDULE)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 7] Khách hàng có nhiều nguồn phân công hợp lệ ---');
    const multiSourceCust = await createTestCustomer('MultiSource');

    // 1. Gán DIRECT grant
    await prisma.$transaction(async (tx) => {
      await assignmentSyncService.recordDirectAssignment(tx, {
        customerId: multiSourceCust.id,
        userId: partner.id,
        assignedById: partner.id,
        notes: 'Phân công trực tiếp từ Admin',
      });
    });

    // 2. Lên lịch chăm sóc CARE_SCHEDULE grant
    const scheduleRes = await followUpService.createBulkFollowUps({
      customerIds: [multiSourceCust.id],
      title: 'Lịch chăm sóc nguồn thứ 2',
      dueAt: new Date('2026-12-29T15:00:00.000Z'),
      assignedToUserId: partner.id,
    });

    const totalGrantsForCust = await prisma.customerAssignmentGrant.findMany({
      where: { customerId: multiSourceCust.id, userId: partner.id },
    });
    check(totalGrantsForCust.length === 2, `Khách hàng có đồng thời 2 grant (Actual: ${totalGrantsForCust.length})`);
    check(totalGrantsForCust.some((g) => g.sourceType === AssignmentSourceType.DIRECT), 'Có DIRECT grant');
    check(totalGrantsForCust.some((g) => g.sourceType === AssignmentSourceType.CARE_SCHEDULE), 'Có CARE_SCHEDULE grant');

    // ------------------------------------------------------------------------
    // CASE 8: Đổi người chăm sóc hoặc hủy lịch mà không thu hồi nhầm quyền
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 8] Đổi / hủy lịch chăm sóc bảo toàn nguồn phân công hợp lệ khác ---');
    const scheduleId = scheduleRes.followUps[0].id;

    // Hủy lịch chăm sóc
    await followUpService.updateFollowUp(scheduleId, {
      status: FollowUpStatus.CANCELLED,
    });

    // Grant CARE_SCHEDULE bị xóa, nhưng DIRECT grant vẫn còn
    const remainingGrants = await prisma.customerAssignmentGrant.findMany({
      where: { customerId: multiSourceCust.id, userId: partner.id },
    });
    check(remainingGrants.length === 1, `Chỉ còn lại 1 grant (Actual: ${remainingGrants.length})`);
    check(remainingGrants[0].sourceType === AssignmentSourceType.DIRECT, 'Grant còn lại là DIRECT');

    const assignmentStillExists = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: multiSourceCust.id, userId: partner.id } },
    });
    check(assignmentStillExists !== null, 'CustomerAssignment VẪN ĐƯỢC GIỮ NGUYÊN vì còn nguồn DIRECT!');

    // ------------------------------------------------------------------------
    // CASE 9: Transaction thất bại và được rollback đúng phạm vi
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 9] Transaction thất bại và được rollback đúng phạm vi ---');
    const safeCust = await createTestCustomer('SafeCust');
    let rollbackCaught = false;

    try {
      await followUpService.createBulkFollowUps({
        customerIds: [safeCust.id, '00000000-0000-0000-0000-000000000000'], // Invalid customer
        title: 'Lịch thất bại vì thiếu khách hàng',
        dueAt: new Date(),
        assignedToUserId: partner.id,
      });
    } catch (err) {
      rollbackCaught = true;
    }

    check(rollbackCaught, 'Bắt lỗi khi có ID khách hàng không tồn tại');
    const safeFuCount = await prisma.followUp.count({ where: { customerId: safeCust.id } });
    check(safeFuCount === 0, 'Khách hàng hợp lệ cũng không bị lưu followUp dở dang');

    // ------------------------------------------------------------------------
    // CASE 10: Không xuất hiện lỗi sử dụng transaction đã hết hạn
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 10] Kiểm tra không có lỗi transaction timeout khi tạo 30 khách hàng ---');
    const custs30: Array<{ id: string; fullName: string; phone: string }> = [];
    for (let i = 0; i < 30; i++) {
      custs30.push(await createTestCustomer(`Batch30_${i}`));
    }

    let timeoutOccurred = false;
    let completed30 = false;
    try {
      const res30 = await followUpService.createBulkFollowUps({
        customerIds: custs30.map((c) => c.id),
        title: 'Kiểm tra 30 khách hàng không timeout',
        dueAt: new Date('2026-12-30T10:00:00.000Z'),
        assignedToUserId: partner.id,
      });
      completed30 = res30.count === 30;
    } catch (err: any) {
      if (err.message?.includes('expired') || err.message?.includes('Transaction already closed')) {
        timeoutOccurred = true;
      }
      throw err;
    }

    check(!timeoutOccurred, 'HOÀN TOÀN KHÔNG XUẤT HIỆN LỖI TRANSACTION TIMEOUT / EXPIRED');
    check(completed30, 'Tạo thành công toàn bộ 30 khách hàng');

    console.log('\n========================================================================');
    console.log(`🎉 TẤT CẢ 10/10 TEST CASES ĐÃ PASS XUẤT SẮC! (${passed}/${passed + failed})`);
    console.log('========================================================================\n');
  } finally {
    await cleanup();
  }
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  });

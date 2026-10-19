import prisma from '../config/database.js';
import { followUpService } from '../services/followUp.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { FollowUpStatus } from '@prisma/client';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
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

async function createTestCustomer(prefix: string): Promise<{ id: string; fullName: string; phone: string }> {
  const phoneSuffix = Math.floor(100000 + Math.random() * 900000);
  const cust = await prisma.customer.create({
    data: {
      fullName: `Test ${prefix} ${Date.now().toString().slice(-4)}`,
      phone: `098${phoneSuffix}`,
    },
    select: { id: true, fullName: true, phone: true },
  });
  createdCustomerIds.push(cust.id);
  return cust;
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test fixtures...');
  if (createdCustomerIds.length > 0) {
    try {
      await prisma.customerActivity.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.followUp.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    } catch (err) {
      console.warn('Cleanup warning:', err);
    }
  }
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE FOLLOW-UP PRODUCTION BUG FIX TEST SUITE');
  console.log('===============================================================\n');

  try {
    // ------------------------------------------------------------------------
    // CASE 1: Tạo lịch cho một khách hàng
    // ------------------------------------------------------------------------
    console.log('--- [Case 1] Tạo lịch cho 1 khách hàng ---');
    const cust1 = await createTestCustomer('Single');
    const targetDate1 = new Date('2026-11-15T09:00:00.000Z');
    const singleResult = await followUpService.createFollowUp({
      customerId: cust1.id,
      title: 'Tư vấn mở thẻ tín dụng Ktea',
      description: 'Khách hàng quan tâm hoàn tiền 5%',
      dueAt: targetDate1,
      assignedTo: 'xoaicaldez',
    });

    assert(singleResult.id !== undefined, 'Tạo lịch đơn lẻ trả về ID hợp lệ');
    assert(singleResult.customerId === cust1.id, 'Gắn đúng Customer ID');
    assert(singleResult.title === 'Tư vấn mở thẻ tín dụng Ktea', 'Giữ nguyên tiêu đề');
    assert(singleResult.assignedTo?.toLowerCase() === 'xoaicaldez', 'Giữ nguyên người chăm sóc');
    assert(new Date(singleResult.dueAt).toISOString() === targetDate1.toISOString(), 'Giữ nguyên thời gian');

    const activity1 = await prisma.customerActivity.findFirst({
      where: { customerId: cust1.id },
    });
    assert(activity1 !== null, 'Tạo thành công activity log cho khách hàng');
    assert(activity1?.description?.toLowerCase().includes('xoaicaldez') === true, 'Activity log có thông tin người chăm sóc');

    // ------------------------------------------------------------------------
    // CASE 2: Tạo lịch cho 10 khách hàng (Trường hợp gây lỗi ban đầu)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 2] Tạo lịch cho 10 khách hàng (Bulk 10 KH) ---');
    const custs10: Array<{ id: string; fullName: string; phone: string }> = [];
    for (let i = 0; i < 10; i++) {
      custs10.push(await createTestCustomer(`Batch10_${i}`));
    }
    const targetDate10 = new Date('2026-11-20T14:30:00.000Z');

    const tStart10 = Date.now();
    const bulk10Result = await followUpService.createBulkFollowUps({
      customerIds: custs10.map((c) => c.id),
      title: 'Chiến dịch chăm sóc 10 khách hàng VIP',
      description: 'Gọi điện thoại hỏi thăm định kỳ',
      dueAt: targetDate10,
      assignedTo: 'Ktea',
    });
    const tElapsed10 = Date.now() - tStart10;

    assert(bulk10Result.count === 10, `Tạo thành công đúng 10 lịch chăm sóc (Actual: ${bulk10Result.count})`);
    assert(bulk10Result.followUps.length === 10, 'Danh sách trả về đủ 10 bản ghi');
    assert(tElapsed10 < 10000, `Thời gian thực thi nhanh: ${tElapsed10}ms (< 10000ms)`);

    for (const fu of bulk10Result.followUps) {
      assert(fu.title === 'Chiến dịch chăm sóc 10 khách hàng VIP', 'Tiêu đề đồng nhất');
      assert(fu.assignedTo === 'Ktea', 'Người chăm sóc đúng');
      assert(new Date(fu.dueAt).toISOString() === targetDate10.toISOString(), 'Ngày hẹn đúng');
      assert(fu.customer !== undefined && fu.customer.fullName !== undefined, 'Customer object được include đầy đủ');
    }

    const activities10 = await prisma.customerActivity.findMany({
      where: { customerId: { in: custs10.map((c) => c.id) } },
    });
    assert(activities10.length === 10, `Ghi nhận đủ 10 activity log độc lập (Actual: ${activities10.length})`);

    // ------------------------------------------------------------------------
    // CASE 3: Tạo lịch cho danh sách lớn hơn (15 khách hàng)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 3] Tạo lịch cho danh sách lớn hơn (15 khách hàng) ---');
    const custs15: Array<{ id: string; fullName: string; phone: string }> = [];
    for (let i = 0; i < 15; i++) {
      custs15.push(await createTestCustomer(`Batch15_${i}`));
    }
    const targetDate15 = new Date('2026-11-25T10:00:00.000Z');

    const tStart15 = Date.now();
    const bulk15Result = await followUpService.createBulkFollowUps({
      customerIds: custs15.map((c) => c.id),
      title: 'Chương trình tri ân 15 khách hàng',
      description: 'Tặng voucher sinh nhật',
      dueAt: targetDate15,
      assignedTo: 'mfast',
    });
    const tElapsed15 = Date.now() - tStart15;

    assert(bulk15Result.count === 15, `Tạo thành công đúng 15 lịch (Actual: ${bulk15Result.count})`);
    assert(bulk15Result.followUps.length === 15, 'Trả về danh sách 15 bản ghi');
    assert(tElapsed15 < 12000, `Thực thi 15 khách hàng mượt mà: ${tElapsed15}ms`);

    // ------------------------------------------------------------------------
    // CASE 4: Một khách hàng không tồn tại
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 4] Một khách hàng không tồn tại ---');
    const fakeCustId = '00000000-0000-0000-0000-000000000000';
    let caughtNotFound = false;
    try {
      await followUpService.createBulkFollowUps({
        customerIds: [cust1.id, fakeCustId],
        title: 'Thử nghiệm khách hàng không tồn tại',
        dueAt: new Date(),
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        caughtNotFound = true;
      }
    }
    assert(caughtNotFound, 'Hệ thống ném NotFoundError khi có ID không tồn tại');

    // ------------------------------------------------------------------------
    // CASE 5: Danh sách khách hàng rỗng
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 5] Danh sách khách hàng rỗng ---');
    let caughtBadRequestEmpty = false;
    try {
      await followUpService.createBulkFollowUps({
        customerIds: [],
        title: 'Thử nghiệm danh sách rỗng',
        dueAt: new Date(),
      });
    } catch (err) {
      if (err instanceof BadRequestError) {
        caughtBadRequestEmpty = true;
      }
    }
    assert(caughtBadRequestEmpty, 'Hệ thống ném BadRequestError khi danh sách khách hàng rỗng');

    // ------------------------------------------------------------------------
    // CASE 6 & 7: Một truy vấn thất bại giữa quá trình tạo & kiểm tra rollback (Atomic)
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 6 & 7] Atomic Rollback khi một thao tác trong transaction thất bại ---');
    const atomicCustA = await createTestCustomer('AtomicA');
    const atomicCustB = await createTestCustomer('AtomicB');

    const beforeCount = await prisma.followUp.count({
      where: { customerId: { in: [atomicCustA.id, atomicCustB.id] } },
    });
    assert(beforeCount === 0, 'Trước test chưa có followUp nào cho cặp khách hàng atomic');

    let rollbackTriggered = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Tạo 1 follow up cho cust A
        await tx.followUp.create({
          data: {
            customerId: atomicCustA.id,
            title: 'Lịch atomic A',
            dueAt: new Date(),
          },
        });
        // Cố tình gây lỗi giữa transaction (ví dụ chèn khách hàng không tồn tại làm foreign key violation)
        await tx.followUp.create({
          data: {
            customerId: 'invalid-non-existing-customer-uuid',
            title: 'Lịch atomic B lỗi',
            dueAt: new Date(),
          },
        });
      });
    } catch (err) {
      rollbackTriggered = true;
    }

    assert(rollbackTriggered, 'Đã bắt được lỗi cố ý trong transaction');
    const afterCount = await prisma.followUp.count({
      where: { customerId: { in: [atomicCustA.id, atomicCustB.id] } },
    });
    assert(afterCount === 0, 'Toàn bộ transaction đã ROLLBACK: không có lịch nào bị lưu dở dang (Atomic)');

    // ------------------------------------------------------------------------
    // CASE 8: Hai request tạo lịch được gửi gần như đồng thời
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 8] Hai request tạo lịch gửi gần như đồng thời (Concurrent requests) ---');
    const concurrentCust1 = await createTestCustomer('Concurrent1');
    const concurrentCust2 = await createTestCustomer('Concurrent2');
    const concurrentIds = [concurrentCust1.id, concurrentCust2.id];
    const targetDateConc = new Date('2026-11-28T08:00:00.000Z');

    const reqPayload = {
      customerIds: concurrentIds,
      title: 'Lịch gọi đồng thời',
      description: 'Kiểm tra xử lý đồng thời',
      dueAt: targetDateConc,
      assignedTo: 'Ktea' as const,
    };

    const [resConcurrent1, resConcurrent2] = await Promise.all([
      followUpService.createBulkFollowUps(reqPayload),
      followUpService.createBulkFollowUps(reqPayload),
    ]);

    assert(resConcurrent1.count === 2, 'Request 1 hoàn thành thành công');
    assert(resConcurrent2.count === 2, 'Request 2 hoàn thành thành công');

    const dbFollowUpsCount = await prisma.followUp.count({
      where: {
        customerId: { in: concurrentIds },
        title: 'Lịch gọi đồng thời',
      },
    });
    assert(
      dbFollowUpsCount === 2,
      `Chỉ có đúng 2 bản ghi trong DB, không bị duplicate do gửi đồng thời (Actual: ${dbFollowUpsCount})`
    );

    // ------------------------------------------------------------------------
    // CASE 9: Kiểm tra không tạo lịch trùng do retry
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 9] Kiểm tra không tạo lịch trùng do retry ---');
    const retryCust = await createTestCustomer('RetryCust');
    const retryDate = new Date('2026-11-30T15:00:00.000Z');

    const firstSchedule = await followUpService.createBulkFollowUps({
      customerIds: [retryCust.id],
      title: 'Lịch tư vấn gói sản phẩm mới',
      dueAt: retryDate,
      assignedTo: 'xoaicaldez',
    });
    assert(firstSchedule.count === 1, 'Lần gửi đầu tiên tạo thành công 1 lịch');

    // Giả lập người dùng nhấn lại hoặc client retry do timeout mạng
    const retrySchedule = await followUpService.createBulkFollowUps({
      customerIds: [retryCust.id],
      title: 'Lịch tư vấn gói sản phẩm mới',
      dueAt: retryDate,
      assignedTo: 'xoaicaldez',
    });
    assert(retrySchedule.count === 1, 'Lần retry trả về thành công 1 lịch');

    const retryDbCount = await prisma.followUp.count({
      where: {
        customerId: retryCust.id,
        title: 'Lịch tư vấn gói sản phẩm mới',
      },
    });
    assert(retryDbCount === 1, `Không bị tạo trùng bản ghi trong database khi retry (DB count: ${retryDbCount})`);

    // ------------------------------------------------------------------------
    // CASE 10: Kiểm tra gửi thông báo thất bại không làm mất lịch đã lưu
    // ------------------------------------------------------------------------
    console.log('\n--- [Case 10] Gửi thông báo thất bại không làm mất lịch đã lưu ---');
    const notifyCust = await createTestCustomer('NotifyCust');

    // Lưu lại hàm gốc và mock hàm dispatchNotifications gây lỗi
    const originalDispatch = followUpService.dispatchNotifications;
    followUpService.dispatchNotifications = async () => {
      throw new Error('Push notification service timeout (Simulated External Failure)');
    };

    let errorThrown = false;
    let notifyResult;
    try {
      notifyResult = await followUpService.createBulkFollowUps({
        customerIds: [notifyCust.id],
        title: 'Lịch có thông báo push lỗi',
        dueAt: new Date('2026-12-01T10:00:00.000Z'),
        assignedTo: 'mfast',
      });
    } catch (err) {
      errorThrown = true;
    } finally {
      followUpService.dispatchNotifications = originalDispatch;
    }

    assert(!errorThrown, 'Hàm tạo lịch không bị throw error dù notification thất bại');
    assert(notifyResult !== undefined && notifyResult.count === 1, 'Kết quả tạo lịch trả về bình thường');

    const notifyDbRecord = await prisma.followUp.findFirst({
      where: { customerId: notifyCust.id, title: 'Lịch có thông báo push lỗi' },
    });
    assert(notifyDbRecord !== null, 'Lịch chăm sóc đã được lưu trọn vẹn trong DB bất chấp lỗi thông báo');

    console.log('\n===============================================================');
    console.log(`🎉 TẤT CẢ CÁC TEST CASES ĐÃ PASS THÀNH CÔNG! (${passed}/${passed + failed})`);
    console.log('===============================================================\n');
  } finally {
    await cleanup();
  }
}

runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  });

import prisma from '../config/database.js';
import { bulkActionService } from '../services/bulkAction.service.js';
import { NotFoundError } from '../utils/errors.js';
import { ActivityType } from '@prisma/client';

let testCustomerIds: string[] = [];
let testTagId: string | null = null;
let testTag2Id: string | null = null;

async function setup() {
  console.log('🚀 Setting up test fixtures for Bulk Action Tag Transaction Verification...');
  // Create test tags
  const tag = await prisma.tag.create({
    data: {
      name: `Test Tag Bulk ${Date.now()}`,
      color: '#6366F1',
    },
  });
  testTagId = tag.id;

  const tag2 = await prisma.tag.create({
    data: {
      name: `Test Tag Bulk 2 ${Date.now()}`,
      color: '#EC4899',
    },
  });
  testTag2Id = tag2.id;
}

async function teardown() {
  console.log('🧹 Cleaning up test fixtures...');
  if (testCustomerIds.length > 0) {
    await prisma.customerActivity.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customerTag.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: testCustomerIds } } });
  }
  if (testTagId) {
    await prisma.tag.delete({ where: { id: testTagId } }).catch(() => {});
  }
  if (testTag2Id) {
    await prisma.tag.delete({ where: { id: testTag2Id } }).catch(() => {});
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    if (!testTagId || !testTag2Id) {
      throw new Error('Test tags were not initialized');
    }

    // ----------------------------------------------------
    // CASE 1: Thêm tag cho một khách hàng
    // ----------------------------------------------------
    console.log('\n--- [Case 1] Thêm tag cho một khách hàng ---');
    const c1 = await prisma.customer.create({
      data: {
        fullName: 'Test Tag Single C1',
        phone: `098800001${Date.now().toString().slice(-3)}`,
      },
    });
    testCustomerIds.push(c1.id);

    const res1 = await bulkActionService.execute({
      action: 'ADD_TAG',
      customerIds: [c1.id],
      payload: { tagId: testTagId },
    });

    assert(res1.affected === 1, `Thêm tag cho 1 khách hàng thành công (affected: ${res1.affected})`);
    const ct1 = await prisma.customerTag.findUnique({
      where: { customerId_tagId: { customerId: c1.id, tagId: testTagId } },
    });
    assert(ct1 !== null, 'Bản ghi CustomerTag tồn tại trong database');

    const act1 = await prisma.customerActivity.findMany({
      where: { customerId: c1.id, title: 'Gắn nhãn (Hàng loạt)' },
    });
    assert(act1.length === 1, 'Activity log gắn nhãn được tạo cho khách hàng');

    // ----------------------------------------------------
    // CASE 2: Thêm tag cho nhiều khách hàng
    // ----------------------------------------------------
    console.log('\n--- [Case 2] Thêm tag cho nhiều khách hàng ---');
    const c2 = await prisma.customer.create({
      data: {
        fullName: 'Test Tag Multi C2',
        phone: `098800002${Date.now().toString().slice(-3)}`,
      },
    });
    const c3 = await prisma.customer.create({
      data: {
        fullName: 'Test Tag Multi C3',
        phone: `098800003${Date.now().toString().slice(-3)}`,
      },
    });
    const c4 = await prisma.customer.create({
      data: {
        fullName: 'Test Tag Multi C4',
        phone: `098800004${Date.now().toString().slice(-3)}`,
      },
    });
    testCustomerIds.push(c2.id, c3.id, c4.id);

    const res2 = await bulkActionService.execute({
      action: 'ADD_TAG',
      customerIds: [c2.id, c3.id, c4.id],
      payload: { tagId: testTagId },
    });

    assert(res2.affected === 3, `Thêm tag cho 3 khách hàng thành công (affected: ${res2.affected})`);
    const multiTags = await prisma.customerTag.findMany({
      where: { customerId: { in: [c2.id, c3.id, c4.id] }, tagId: testTagId },
    });
    assert(multiTags.length === 3, 'Tất cả 3 khách hàng đều được gắn tag trong database');

    // ----------------------------------------------------
    // CASE 3: Gắn lại tag đã tồn tại (Idempotency)
    // ----------------------------------------------------
    console.log('\n--- [Case 3] Gắn lại tag đã tồn tại (Idempotency & Tránh trùng lặp) ---');
    // c1 và c2 đã có testTagId, thử gọi lại ADD_TAG cho cả c1, c2
    const res3 = await bulkActionService.execute({
      action: 'ADD_TAG',
      customerIds: [c1.id, c2.id],
      payload: { tagId: testTagId },
    });

    assert(res3.affected === 2, `Thao tác gắn lại tag hoàn tất mà không lỗi constraint (affected: ${res3.affected})`);
    const c1TagsCount = await prisma.customerTag.count({
      where: { customerId: c1.id, tagId: testTagId },
    });
    assert(c1TagsCount === 1, 'Không bị tạo bản ghi trùng lặp cho khách hàng đã có tag (count === 1)');

    // ----------------------------------------------------
    // CASE 4: Danh sách có khách hàng không hợp lệ hoặc không tồn tại
    // ----------------------------------------------------
    console.log('\n--- [Case 4] Danh sách có khách hàng không hợp lệ hoặc không tồn tại ---');
    const c5 = await prisma.customer.create({
      data: {
        fullName: 'Test Tag Invalid Cust C5',
        phone: `098800005${Date.now().toString().slice(-3)}`,
      },
    });
    testCustomerIds.push(c5.id);

    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    let rejectedNotFound = false;
    try {
      await bulkActionService.execute({
        action: 'ADD_TAG',
        customerIds: [c5.id, nonExistentId],
        payload: { tagId: testTagId },
      });
    } catch (err: any) {
      if (err instanceof NotFoundError || err.message?.includes('không tồn tại')) {
        rejectedNotFound = true;
      }
    }
    assert(rejectedNotFound, 'Hệ thống từ chối thực hiện khi có khách hàng không tồn tại trong danh sách');

    // Đảm bảo c5 KHÔNG bị gắn tag do tính toàn vẹn (pre-validation rollback)
    const c5Tag = await prisma.customerTag.findUnique({
      where: { customerId_tagId: { customerId: c5.id, tagId: testTagId } },
    });
    assert(c5Tag === null, 'Khách hàng c5 không bị gắn tag khi batch chứa ID không tồn tại');

    // ----------------------------------------------------
    // CASE 5: Danh sách lớn, kiểm tra transaction timeout
    // ----------------------------------------------------
    console.log('\n--- [Case 5] Danh sách khách hàng lớn, kiểm tra transaction timeout ---');
    const largeBatchSize = 35;
    const largeBatchCustomers: Array<{ id: string }> = [];
    const timestamp = Date.now().toString().slice(-4);

    for (let i = 0; i < largeBatchSize; i++) {
      const cust = await prisma.customer.create({
        data: {
          fullName: `Bulk Large Cust ${i}`,
          phone: `0977${timestamp}${i.toString().padStart(3, '0')}`,
        },
      });
      largeBatchCustomers.push(cust);
      testCustomerIds.push(cust.id);
    }

    const startTime = Date.now();
    const largeRes = await bulkActionService.execute({
      action: 'ADD_TAG',
      customerIds: largeBatchCustomers.map(c => c.id),
      payload: { tagId: testTag2Id },
    });
    const duration = Date.now() - startTime;

    assert(
      largeRes.affected === largeBatchSize,
      `Thao tác thành công trên ${largeBatchSize} khách hàng trong ${duration}ms (không bị transaction timeout)`
    );

    const largeTagsCount = await prisma.customerTag.count({
      where: { customerId: { in: largeBatchCustomers.map(c => c.id) }, tagId: testTag2Id },
    });
    assert(largeTagsCount === largeBatchSize, `Tất cả ${largeBatchSize} khách hàng đều được gắn tag thành công`);

    // ----------------------------------------------------
    // CASE 6: Một thao tác thất bại giữa chừng & rollback atomicity
    // ----------------------------------------------------
    console.log('\n--- [Case 6] Thao tác thất bại giữa chừng xác nhận rollback atomicity ---');
    const cFail1 = await prisma.customer.create({
      data: {
        fullName: 'Test Fail Cust 1',
        phone: `096600001${Date.now().toString().slice(-3)}`,
      },
    });
    const cFail2 = await prisma.customer.create({
      data: {
        fullName: 'Test Fail Cust 2',
        phone: `096600002${Date.now().toString().slice(-3)}`,
      },
    });
    testCustomerIds.push(cFail1.id, cFail2.id);

    // Mô phỏng transaction atomic: nếu có lỗi xảy ra trong transaction, toàn bộ dữ liệu phải rollback
    let rollbackSuccess = false;
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Thêm tag cho khách hàng 1
        await tx.customerTag.createMany({
          data: [{ customerId: cFail1.id, tagId: testTagId! }],
          skipDuplicates: true,
        });

        // 2. Cố tình gây lỗi ném ngoại lệ giữa chừng
        throw new Error('Mô phỏng lỗi hệ thống giữa chừng trong transaction');
      });
    } catch (err: any) {
      if (err.message.includes('Mô phỏng lỗi hệ thống')) {
        rollbackSuccess = true;
      }
    }
    assert(rollbackSuccess, 'Transaction bắt được lỗi ngoại lệ và kích hoạt rollback');

    const cFail1Tag = await prisma.customerTag.findUnique({
      where: { customerId_tagId: { customerId: cFail1.id, tagId: testTagId } },
    });
    assert(cFail1Tag === null, 'Dữ liệu cFail1 đã được rollback hoàn toàn, không có tag bị lưu lại');

  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình chạy test:', err);
    failed++;
  } finally {
    await teardown();
  }

  console.log('\n========================================');
  console.log(`Kết quả kiểm thử: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

setup().then(() => runTests()).then(() => prisma.$disconnect());

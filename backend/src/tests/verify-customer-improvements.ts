import prisma from '../config/database.js';
import { bulkActionService } from '../services/bulkAction.service.js';
import { followUpService } from '../services/followUp.service.js';
import { customerService } from '../services/customer.service.js';
import { VALID_CARETAKERS, createFollowUpSchema, createBulkFollowUpSchema } from '../validations/followUp.validation.js';
import { CustomerStatus, PriorityLevel, FollowUpStatus } from '@prisma/client';

const testCustomerIds: string[] = [];
const testSourceIds: string[] = [];

async function setup() {
  console.log('🚀 Setting up test fixtures for Customer Management & Care Scheduling Improvements...');
}

async function teardown() {
  console.log('🧹 Cleaning up test fixtures...');
  if (testCustomerIds.length > 0) {
    await prisma.customerActivity.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customerNote.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.followUp.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customerTag.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customerNeed.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customerCase.deleteMany({ where: { customerId: { in: testCustomerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: testCustomerIds } } });
  }
  if (testSourceIds.length > 0) {
    await prisma.customerSource.deleteMany({ where: { id: { in: testSourceIds } } });
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
    // ----------------------------------------------------
    // TEST 1: Chọn nhiều khách hàng và xóa có xác nhận
    // ----------------------------------------------------
    console.log('\n--- [Test 1] Chọn nhiều khách hàng và xóa hàng loạt ---');
    const c1 = await prisma.customer.create({
      data: {
        fullName: 'Test Bulk Delete C1',
        phone: `099999001${Date.now().toString().slice(-3)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });
    const c2 = await prisma.customer.create({
      data: {
        fullName: 'Test Bulk Delete C2',
        phone: `099999002${Date.now().toString().slice(-3)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });
    testCustomerIds.push(c1.id, c2.id);

    const deleteRes = await bulkActionService.execute({
      action: 'DELETE_CUSTOMERS',
      customerIds: [c1.id, c2.id],
      payload: {},
    });

    assert(deleteRes.affected === 2, `Xóa thành công 2 khách hàng không có dữ liệu ràng buộc (Actual: ${deleteRes.affected})`);
    const c1Exists = await prisma.customer.findUnique({ where: { id: c1.id } });
    const c2Exists = await prisma.customer.findUnique({ where: { id: c2.id } });
    assert(!c1Exists && !c2Exists, 'Các khách hàng đã bị xóa thực sự khỏi database');

    // ----------------------------------------------------
    // TEST 2: Khách hàng có dữ liệu lịch sử không bị xóa dây chuyền ngoài ý muốn
    // ----------------------------------------------------
    console.log('\n--- [Test 2] Khách hàng có dữ liệu lịch sử được bảo vệ không bị xóa ---');
    const protectedCust = await prisma.customer.create({
      data: {
        fullName: 'Test Protected Customer',
        phone: `099999003${Date.now().toString().slice(-3)}`,
        overallStatus: CustomerStatus.DANG_TU_VAN,
      },
    });
    testCustomerIds.push(protectedCust.id);

    // Gán 1 lịch chăm sóc FollowUp
    const fuProt = await prisma.followUp.create({
      data: {
        customerId: protectedCust.id,
        title: 'Lịch tư vấn quan trọng',
        dueAt: new Date(),
        status: FollowUpStatus.PENDING,
      },
    });

    // Cố gắng bulk delete khách hàng được bảo vệ
    const deleteAttempt = await bulkActionService.execute({
      action: 'DELETE_CUSTOMERS',
      customerIds: [protectedCust.id],
      payload: {},
    });

    assert(deleteAttempt.affected === 0, 'Khách hàng có lịch chăm sóc không bị xóa (affected === 0)');
    assert(deleteAttempt.failedCount === 1, 'Báo cáo chính xác 1 trường hợp thất bại');
    assert(
      Boolean(deleteAttempt.failedDetails?.[0]?.reason.includes('lịch chăm sóc')),
      `Lý do từ chối rõ ràng: ${deleteAttempt.failedDetails?.[0]?.reason}`
    );

    const checkStillAlive = await prisma.customer.findUnique({ where: { id: protectedCust.id } });
    assert(checkStillAlive !== null, 'Dữ liệu khách hàng và lịch sử vẫn còn nguyên vẹn trong database');

    // Dọn dẹp FollowUp của test 2
    await prisma.followUp.delete({ where: { id: fuProt.id } });

    // ----------------------------------------------------
    // TEST 3 & 4: Gán nguồn hàng loạt & từ chối nguồn không hợp lệ / inactive
    // ----------------------------------------------------
    console.log('\n--- [Test 3 & 4] Gán nguồn khách hàng hàng loạt & validation nguồn ---');
    const sourceActive = await prisma.customerSource.create({
      data: {
        name: `Nguồn Test Active ${Date.now()}`,
        active: true,
      },
    });
    const sourceInactive = await prisma.customerSource.create({
      data: {
        name: `Nguồn Test Inactive ${Date.now()}`,
        active: false,
      },
    });
    testSourceIds.push(sourceActive.id, sourceInactive.id);

    const cAssign1 = await prisma.customer.create({
      data: {
        fullName: 'Test Assign Source 1',
        phone: `099999004${Date.now().toString().slice(-3)}`,
      },
    });
    const cAssign2 = await prisma.customer.create({
      data: {
        fullName: 'Test Assign Source 2',
        phone: `099999005${Date.now().toString().slice(-3)}`,
      },
    });
    testCustomerIds.push(cAssign1.id, cAssign2.id);

    // Gán nguồn active hợp lệ
    const assignRes = await bulkActionService.execute({
      action: 'ASSIGN_SOURCE',
      customerIds: [cAssign1.id, cAssign2.id],
      payload: { sourceId: sourceActive.id },
    });
    assert(assignRes.affected === 2, `Gán thành công nguồn cho 2 khách hàng (Actual: ${assignRes.affected})`);

    const c1Updated = await prisma.customer.findUnique({ where: { id: cAssign1.id } });
    assert(c1Updated?.sourceId === sourceActive.id && c1Updated?.source === sourceActive.name, 'sourceId và tên nguồn được cập nhật đúng');

    // Thử gán nguồn inactive -> phải throw error
    let inactiveBlocked = false;
    try {
      await bulkActionService.execute({
        action: 'ASSIGN_SOURCE',
        customerIds: [cAssign1.id],
        payload: { sourceId: sourceInactive.id },
      });
    } catch (err: any) {
      inactiveBlocked = true;
      assert(err.message.includes('ngưng hoạt động'), `Từ chối gán nguồn inactive với thông báo: ${err.message}`);
    }
    assert(inactiveBlocked, 'Hệ thống chặn thành công việc gán nguồn inactive');

    // Thử gán nguồn không tồn tại
    let notFoundBlocked = false;
    try {
      await bulkActionService.execute({
        action: 'ASSIGN_SOURCE',
        customerIds: [cAssign1.id],
        payload: { sourceId: '00000000-0000-0000-0000-000000000000' },
      });
    } catch {
      notFoundBlocked = true;
    }
    assert(notFoundBlocked, 'Hệ thống từ chối nguồn không tồn tại');

    // ----------------------------------------------------
    // TEST 5 & 6: Người chăm sóc hợp lệ và từ chối người chăm sóc không hợp lệ
    // ----------------------------------------------------
    console.log('\n--- [Test 5 & 6] Người chăm sóc hợp lệ và validation backend ---');
    assert(VALID_CARETAKERS.length === 3, 'Tập danh sách người chăm sóc đúng 3 giá trị: Ktea, xoaicaldez, mfast');

    for (const caretaker of VALID_CARETAKERS) {
      const fu = await followUpService.createFollowUp({
        customerId: cAssign1.id,
        title: `Chăm sóc bởi ${caretaker}`,
        dueAt: new Date(),
        assignedTo: caretaker,
      });
      assert(fu.assignedTo === caretaker, `Tạo lịch chăm sóc với người chăm sóc "${caretaker}" thành công`);
    }

    // Kiểm tra validation Zod từ chối người chăm sóc không hợp lệ
    const invalidSchemaResult = createFollowUpSchema.safeParse({
      customerId: cAssign1.id,
      title: 'Invalid Caretaker Test',
      dueAt: new Date().toISOString(),
      assignedTo: 'admin_khong_hop_le',
    });
    assert(!invalidSchemaResult.success, 'Backend schema từ chối người chăm sóc không thuộc danh sách');

    // ----------------------------------------------------
    // TEST 7 & 8: Trường ghi chú được lưu và đọc chính xác & dữ liệu địa chỉ cũ không bị mất
    // ----------------------------------------------------
    console.log('\n--- [Test 7 & 8] Trường ghi chú và bảo toàn dữ liệu địa chỉ cũ ---');
    // Khách hàng legacy với address cũ
    const legacyCust = await prisma.customer.create({
      data: {
        fullName: 'Test Legacy Address Cust',
        phone: `099999006${Date.now().toString().slice(-3)}`,
        address: 'Địa chỉ cũ: 123 Đường Cũ, Quận 1',
        note: null,
      },
    });
    testCustomerIds.push(legacyCust.id);

    const legacyDetail = await customerService.getCustomerDetail(legacyCust.id);
    assert(
      legacyDetail.note === 'Địa chỉ cũ: 123 Đường Cũ, Quận 1',
      'Đọc chính xác dữ liệu cũ khi note ban đầu là null'
    );
    const legacyRaw = await prisma.customer.findUnique({ where: { id: legacyCust.id } });
    assert(
      legacyRaw?.address === 'Địa chỉ cũ: 123 Đường Cũ, Quận 1',
      'Dữ liệu cột address trong database không bị xóa hay ghi đè mất'
    );

    // Tạo khách hàng mới với ghi chú nghiệp vụ tự do
    const newCustWithNote = await customerService.createCustomer({
      fullName: 'Test New Cust Note',
      phone: `099999007${Date.now().toString().slice(-3)}`,
      note: 'Khách hàng quan tâm gói vay thế chấp 2 tỷ',
    });
    testCustomerIds.push(newCustWithNote.id);

    const newCustDetail = await customerService.getCustomerDetail(newCustWithNote.id);
    assert(
      newCustDetail.note === 'Khách hàng quan tâm gói vay thế chấp 2 tỷ',
      'Lưu và đọc chính xác ghi chú của khách hàng mới'
    );

    // ----------------------------------------------------
    // TEST 9, 10 & 11: Lên lịch chăm sóc cho nhiều khách hàng trong 1 lần submit
    // ----------------------------------------------------
    console.log('\n--- [Test 9, 10 & 11] Lên lịch chăm sóc cho nhiều khách hàng hàng loạt ---');
    const bulkCustA = await prisma.customer.create({
      data: {
        fullName: 'Bulk Schedule Cust A',
        phone: `099999008${Date.now().toString().slice(-3)}`,
      },
    });
    const bulkCustB = await prisma.customer.create({
      data: {
        fullName: 'Bulk Schedule Cust B',
        phone: `099999009${Date.now().toString().slice(-3)}`,
      },
    });
    const bulkCustC = await prisma.customer.create({
      data: {
        fullName: 'Bulk Schedule Cust C',
        phone: `099999010${Date.now().toString().slice(-3)}`,
      },
    });
    testCustomerIds.push(bulkCustA.id, bulkCustB.id, bulkCustC.id);

    const targetDueDate = new Date('2026-11-20T10:00:00.000Z');
    const bulkResult = await followUpService.createBulkFollowUps({
      customerIds: [bulkCustA.id, bulkCustB.id, bulkCustC.id],
      title: 'Chiến dịch tư vấn lãi suất ưu đãi quý 4',
      description: 'Gọi điện trao đổi chương trình giảm 0.5% lãi suất tháng đầu',
      dueAt: targetDueDate,
      assignedTo: 'xoaicaldez',
    });

    assert(bulkResult.count === 3, `Tạo thành công đúng 3 bản ghi lịch chăm sóc (Actual: ${bulkResult.count})`);
    assert(bulkResult.followUps.length === 3, 'Trả về danh sách 3 FollowUp độc lập');

    // Kiểm tra từng bản ghi
    for (const item of bulkResult.followUps) {
      assert(
        [bulkCustA.id, bulkCustB.id, bulkCustC.id].includes(item.customerId),
        `Bản ghi ${item.id} gắn đúng Customer ID ${item.customerId}`
      );
      assert(
        item.title === 'Chiến dịch tư vấn lãi suất ưu đãi quý 4',
        `Tiêu đề đúng: "${item.title}"`
      );
      assert(
        item.assignedTo === 'xoaicaldez',
        `Người chăm sóc đúng: "${item.assignedTo}"`
      );
      assert(
        new Date(item.dueAt).toISOString() === targetDueDate.toISOString(),
        'Thời gian hẹn chính xác'
      );
    }

    // Kiểm tra hoạt động activity được ghi nhận độc lập
    const activitiesA = await prisma.customerActivity.findMany({ where: { customerId: bulkCustA.id } });
    assert(activitiesA.length > 0 && activitiesA.some(a => a.description?.includes('xoaicaldez')), 'Customer A có activity log chứa thông tin người chăm sóc');

    // ----------------------------------------------------
    // TEST 12: Thống kê và danh sách phản ánh đúng dữ liệu
    // ----------------------------------------------------
    console.log('\n--- [Test 12] Truy vấn danh sách và chi tiết ---');
    const allFollowUps = await followUpService.getFollowUps('all', undefined, bulkCustA.id);
    assert(allFollowUps.length >= 1, `Khách hàng A truy vấn được lịch chăm sóc riêng (Count: ${allFollowUps.length})`);
    assert(allFollowUps[0].assignedTo === 'xoaicaldez', 'Người chăm sóc xoaicaldez được trả về trong query');

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

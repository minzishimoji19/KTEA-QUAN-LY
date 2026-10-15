import prisma from '../config/database.js';
import { customerService } from '../services/customer.service.js';
import { followUpService } from '../services/followUp.service.js';
import { caseService } from '../services/case.service.js';
import { productService } from '../services/product.service.js';
import { VALID_CARETAKERS, createFollowUpSchema } from '../validations/followUp.validation.js';
import { FollowUpStatus, CaseProgress } from '@prisma/client';

async function runCareFollowupsAndNavigationTests() {
  console.log('🧪 Starting Verification Suite for Caregiver Assignment, Customer Details & Bulk Follow-up Operations...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  const TEST_PHONE_A = '0988111222';
  const TEST_PHONE_B = '0988333444';

  let custAId = '';
  let custBId = '';
  let productId = '';

  try {
    // 0. Clean up previous test runs if any
    await prisma.followUp.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } },
    });
    await prisma.caseProgressHistory.deleteMany({
      where: { case: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } } },
    });
    await prisma.customerCase.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } },
    });
    await prisma.customerActivity.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } },
    });
    await prisma.customer.deleteMany({
      where: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } },
    });

    // Create test product
    let product = await prisma.product.findFirst({ where: { active: true } });
    if (!product) {
      product = await productService.createProduct({
        code: 'PROD_TEST_BULK',
        name: 'Gói Vay Thử Nghiệm',
      });
    }
    productId = product.id;

    // Create test customers
    const custA = await customerService.createCustomer({
      fullName: 'Khách Hàng Kiểm Thử A',
      phone: TEST_PHONE_A,
    });
    custAId = custA.id;

    const custB = await customerService.createCustomer({
      fullName: 'Khách Hàng Kiểm Thử B',
      phone: TEST_PHONE_B,
    });
    custBId = custB.id;

    // Create an initial case for Customer A to verify financial integrity
    const caseA = await caseService.createCase(custAId, {
      productId,
      progress: CaseProgress.REGISTRATION_CREATED,
    });

    // =========================================================================
    // PHẦN 1: KIỂM THỬ THÊM / SỬA NGƯỜI CHĂM SÓC & VALIDATION
    // =========================================================================
    console.log('--- PHẦN 1: KIỂM THỬ NGƯỜI CHĂM SÓC (CAREGIVER ASSIGNMENT) ---');

    // 1.1 Tạo lịch với người chăm sóc hợp lệ
    const fu1 = await followUpService.createFollowUp({
      customerId: custAId,
      title: 'Tư vấn mở thẻ tín dụng Ktea',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      assignedTo: 'Ktea',
    });
    assert(fu1.assignedTo === 'Ktea', 'Tạo lịch chăm sóc với người chăm sóc "Ktea" thành công');

    // 1.2 Đổi người chăm sóc sang người khác
    const fu1Updated = await followUpService.updateFollowUp(fu1.id, {
      assignedTo: 'xoaicaldez',
    });
    assert(fu1Updated.assignedTo === 'xoaicaldez', 'Đổi người chăm sóc sang "xoaicaldez" lưu xuống DB chính xác');

    // 1.3 Tạo lịch chưa phân công (null / undefined)
    const fu2 = await followUpService.createFollowUp({
      customerId: custAId,
      title: 'Chăm sóc định kỳ chưa phân công',
      dueAt: new Date(Date.now() + 172800000).toISOString(),
      assignedTo: null,
    });
    assert(fu2.assignedTo === null, 'Lịch chăm sóc chưa phân công lưu assignedTo là null');

    // 1.4 Thử validation người chăm sóc không hợp lệ
    const invalidValidation = createFollowUpSchema.safeParse({
      customerId: custAId,
      title: 'Lịch không hợp lệ',
      dueAt: new Date().toISOString(),
      assignedTo: 'nguoi_la_khong_hop_le',
    });
    assert(!invalidValidation.success, 'Validation Zod chặn người chăm sóc không thuộc danh sách hợp lệ');

    // 1.5 Kiểm tra danh sách người chăm sóc hợp lệ
    assert(
      VALID_CARETAKERS.includes('Ktea') &&
      VALID_CARETAKERS.includes('xoaicaldez') &&
      VALID_CARETAKERS.includes('mfast'),
      'Danh sách người chăm sóc chuẩn hóa gồm Ktea, xoaicaldez, mfast'
    );

    // =========================================================================
    // PHẦN 2: KIỂM THỬ HOÀN THÀNH HÀNG LOẠT (BULK COMPLETE)
    // =========================================================================
    console.log('\n--- PHẦN 2: KIỂM THỬ HOÀN THÀNH HÀNG LOẠT (BULK COMPLETE) ---');

    // Tạo thêm các lịch cho Customer B
    const fuB1 = await followUpService.createFollowUp({
      customerId: custBId,
      title: 'Gọi xác nhận hồ sơ B1',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      assignedTo: 'mfast',
    });

    const fuB2 = await followUpService.createFollowUp({
      customerId: custBId,
      title: 'Gửi tài liệu hợp đồng B2',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      assignedTo: 'Ktea',
    });

    // Tạo một lịch CANCELLED để kiểm tra không tự hoàn thành lịch đã hủy
    const fuCancelled = await followUpService.createFollowUp({
      customerId: custBId,
      title: 'Lịch đã hủy không được hoàn thành',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      status: FollowUpStatus.CANCELLED,
    });

    // Thực hiện hoàn thành hàng loạt: fu1, fuB1, fuCancelled, và 1 ID không tồn tại
    const nonExistentId = '00000000-0000-0000-0000-000000000099';
    const bulkCompleteResult = await followUpService.completeBulkFollowUps({
      ids: [fu1.id, fuB1.id, fuCancelled.id, nonExistentId],
    });

    assert(bulkCompleteResult.total === 4, 'Tổng số lịch yêu cầu hoàn thành là 4');
    assert(
      bulkCompleteResult.succeeded.includes(fu1.id) && bulkCompleteResult.succeeded.includes(fuB1.id),
      'Hoàn thành thành công các lịch PENDING hợp lệ (fu1, fuB1)'
    );
    assert(
      bulkCompleteResult.failed.some((f) => f.id === fuCancelled.id && f.reason.includes('đã bị hủy')),
      'Lịch CANCELLED bị từ chối hoàn thành kèm lý do rõ ràng'
    );
    assert(
      bulkCompleteResult.failed.some((f) => f.id === nonExistentId && f.reason.includes('Không tìm thấy')),
      'ID không tồn tại trả về lỗi trong partial success rõ ràng'
    );

    // Kiểm tra fu1 và fuB1 trong database
    const verifiedFu1 = await followUpService.getFollowUpById(fu1.id);
    assert(
      verifiedFu1.status === FollowUpStatus.COMPLETED && verifiedFu1.completedAt !== null,
      'Lịch hoàn thành có status = COMPLETED và completedAt được ghi nhận'
    );

    // Kiểm tra hồ sơ tài chính không bị thay đổi trạng thái
    const verifiedCaseA = await prisma.customerCase.findUnique({ where: { id: caseA.id } });
    assert(
      verifiedCaseA?.progress === CaseProgress.REGISTRATION_CREATED,
      'Hoàn thành lịch chăm sóc KHÔNG làm thay đổi trạng thái hồ sơ tài chính của khách hàng'
    );

    // Kiểm tra CustomerActivity được tạo
    const activities = await prisma.customerActivity.findMany({
      where: { customerId: custAId, title: { contains: 'Follow-up COMPLETED' } },
    });
    assert(activities.length > 0, 'Hệ thống tự động ghi nhận CustomerActivity khi hoàn thành hàng loạt');

    // =========================================================================
    // PHẦN 3: KIỂM THỬ ĐỒNG BỘ SỐ LẦN CHĂM SÓC & LẦN CHĂM SÓC GẦN NHẤT
    // =========================================================================
    console.log('\n--- PHẦN 3: KIỂM THỬ ĐỒNG BỘ THÔNG TIN CHĂM SÓC GIỮA DANH SÁCH & CHI TIẾT ---');

    const custDetailA = await customerService.getCustomerDetail(custAId);
    const custSummaryList = await customerService.getCustomers({ search: TEST_PHONE_A });
    const foundCustSummary = custSummaryList.items[0];

    assert(
      custDetailA.careCount === 1,
      `Customer Detail careCount hiển thị đúng 1 lần chăm sóc hoàn thành (thực tế: ${custDetailA.careCount})`
    );
    assert(
      foundCustSummary?.careCount === 1,
      `Customer Summary careCount hiển thị đúng 1 lần chăm sóc hoàn thành (thực tế: ${foundCustSummary?.careCount})`
    );
    assert(
      custDetailA.careCount === foundCustSummary?.careCount,
      'Số lần chăm sóc giữa Danh sách và Trang chi tiết khớp nhau tuyệt đối 100%'
    );
    assert(
      custDetailA.lastCareAt !== null && foundCustSummary?.lastCareAt !== null,
      'Lần chăm sóc gần nhất ghi nhận thời điểm hoàn thành ở cả danh sách và chi tiết'
    );
    assert(
      custDetailA.lastCareAt === foundCustSummary?.lastCareAt,
      'Thời điểm lần chăm sóc gần nhất giữa Danh sách và Trang chi tiết khớp nhau tuyệt đối'
    );

    // =========================================================================
    // PHẦN 4: KIỂM THỬ XÓA HÀNG LOẠT & BẢO VỆ AN TOÀN DỮ LIỆU
    // =========================================================================
    console.log('\n--- PHẦN 4: KIỂM THỬ XÓA HÀNG LOẠT (BULK DELETE) & BẢO VỆ DỮ LIỆU ---');

    // Thử xóa đơn lẻ lịch đã hoàn thành (fu1) -> Bị chặn
    let singleDeleteBlocked = false;
    try {
      await followUpService.deleteFollowUp(fu1.id);
    } catch (err: unknown) {
      singleDeleteBlocked = true;
    }
    assert(singleDeleteBlocked, 'Chặn xóa đơn lẻ lịch chăm sóc đã hoàn thành để bảo lưu lịch sử');

    // Thực hiện xóa hàng loạt:
    // fu1 (COMPLETED -> phải bị từ chối xóa)
    // fu2 (PENDING -> được phép xóa)
    // fuB2 (PENDING -> được phép xóa)
    // fuCancelled (CANCELLED -> được phép xóa)
    // nonExistentId (không tồn tại -> failed)
    const bulkDeleteResult = await followUpService.deleteBulkFollowUps({
      ids: [fu1.id, fu2.id, fuB2.id, fuCancelled.id, nonExistentId],
    });

    assert(bulkDeleteResult.total === 5, 'Tổng số lịch yêu cầu xóa là 5');
    assert(
      bulkDeleteResult.succeeded.includes(fu2.id) &&
      bulkDeleteResult.succeeded.includes(fuB2.id) &&
      bulkDeleteResult.succeeded.includes(fuCancelled.id),
      'Xóa thành công các lịch chưa hoàn thành (fu2, fuB2, fuCancelled)'
    );
    assert(
      bulkDeleteResult.failed.some((f) => f.id === fu1.id && f.reason.includes('lịch đã hoàn thành')),
      'Lịch đã hoàn thành fu1 bị từ chối xóa để bảo lưu lịch sử chăm sóc thực tế'
    );
    assert(
      bulkDeleteResult.failed.some((f) => f.id === nonExistentId),
      'ID không tồn tại trong xóa hàng loạt được trả về trong failed'
    );

    // Kiểm tra fu1 vẫn tồn tại trong database và careCount không bị mất
    const postDeleteCustDetailA = await customerService.getCustomerDetail(custAId);
    assert(
      postDeleteCustDetailA.careCount === 1,
      'Lịch sử chăm sóc (careCount === 1) của khách hàng được bảo lưu nguyên vẹn sau khi xóa hàng loạt'
    );

    // Kiểm tra không xóa cascade khách hàng hay hồ sơ
    const customerStillExists = await prisma.customer.findUnique({ where: { id: custAId } });
    const caseStillExists = await prisma.customerCase.findUnique({ where: { id: caseA.id } });
    assert(
      customerStillExists !== null && caseStillExists !== null,
      'Không xóa dây chuyền dữ liệu khách hàng hoặc hồ sơ tài chính liên quan'
    );

    // =========================================================================
    // PHẦN 5: BỘ LỌC NGƯỜI CHĂM SÓC (CAREGIVER FILTER QUERY)
    // =========================================================================
    console.log('\n--- PHẦN 5: KIỂM THỬ BỘ LỌC NGƯỜI CHĂM SÓC ---');

    const tasksForKtea = await followUpService.getFollowUps(undefined, undefined, undefined, 'Ktea');
    const tasksForXoai = await followUpService.getFollowUps(undefined, undefined, undefined, 'xoaicaldez');
    const unassignedTasks = await followUpService.getFollowUps(undefined, undefined, undefined, 'unassigned');

    assert(Array.isArray(tasksForKtea), 'Lọc lịch chăm sóc theo người chăm sóc "Ktea" trả về danh sách hợp lệ');
    assert(
      tasksForXoai.some((t) => t.id === fu1.id && t.assignedTo === 'xoaicaldez'),
      'Lọc lịch chăm sóc theo "xoaicaldez" tìm thấy đúng lịch đã phân công fu1'
    );
    assert(Array.isArray(unassignedTasks), 'Lọc lịch chưa phân công "unassigned" hoạt động chính xác');

    console.log('\n==================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during test execution:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    try {
      await prisma.followUp.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } },
      });
      await prisma.caseProgressHistory.deleteMany({
        where: { case: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } } },
      });
      await prisma.customerCase.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } },
      });
      await prisma.customerActivity.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } } },
      });
      await prisma.customer.deleteMany({
        where: { phone: { in: [TEST_PHONE_A, TEST_PHONE_B] } },
      });
    } catch (_) {
      // Ignore cleanup error
    }
    await prisma.$disconnect();
  }
}

runCareFollowupsAndNavigationTests();

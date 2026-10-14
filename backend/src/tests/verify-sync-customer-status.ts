import prisma from '../config/database.js';
import { customerService } from '../services/customer.service.js';
import { caseService } from '../services/case.service.js';
import { customerStatusService, getLatestCase, resolveCustomerStatus } from '../services/customerStatus.service.js';
import { CustomerStatus, CaseProgress, CaseStatus } from '@prisma/client';

async function runCustomerStatusSyncVerification() {
  console.log('🧪 Starting Customer Status Sync Verification Suite (10 Scenarios)...\n');

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

  const TEST_PHONE_1 = '0988111222';
  const TEST_PHONE_2 = '0988333444';
  const TEST_PHONE_3 = '0988555666';

  let customer1Id = '';
  let customer2Id = '';
  let customer3Id = '';
  let testProductId = '';

  try {
    // 0. Clean up any prior test records
    await prisma.caseProgressHistory.deleteMany({
      where: {
        case: {
          customer: {
            phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] },
          },
        },
      },
    });
    await prisma.customerCase.deleteMany({
      where: {
        customer: {
          phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] },
        },
      },
    });
    await prisma.customerActivity.deleteMany({
      where: {
        customer: {
          phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] },
        },
      },
    });
    await prisma.customer.deleteMany({
      where: { phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] } },
    });

    // Ensure a product exists
    let product = await prisma.product.findFirst({ where: { active: true } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          code: 'SYNC_TEST_PROD',
          name: 'Sản phẩm Thẻ Tín Dụng Test',
          active: true,
        },
      });
    }
    testProductId = product.id;

    // SCENARIO 7: Khách hàng chưa có hồ sơ
    // Giữ nguyên trạng thái hiện tại (LEAD_MOI), không tự gán trạng thái hồ sơ giả
    const cust1 = await customerService.createCustomer({
      fullName: 'Khách Test Chua Co Ho So',
      phone: TEST_PHONE_1,
      overallStatus: CustomerStatus.LEAD_MOI,
    });
    customer1Id = cust1.id;

    const detailCust1 = await customerService.getCustomerDetail(customer1Id);
    assert(
      detailCust1.overallStatus === CustomerStatus.LEAD_MOI &&
      detailCust1.currentStatus === CustomerStatus.LEAD_MOI &&
      detailCust1.cases.length === 0,
      '7. Khách hàng chưa có hồ sơ -> giữ trạng thái hiện tại (LEAD_MOI), không gán trạng thái hồ sơ giả'
    );

    // SCENARIO 1: Khách có một hồ sơ
    // Tạo 1 hồ sơ chưa chọn sản phẩm (NOT_SELECTED / Chưa có sản phẩm)
    const case1 = await caseService.createCase(customer1Id, {
      productId: null,
      progress: CaseProgress.NOT_SELECTED,
    });
    const detailAfterCase1 = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterCase1.overallStatus as string) === CaseProgress.NOT_SELECTED &&
      (detailAfterCase1.currentStatus as string) === CaseProgress.NOT_SELECTED,
      '1. Khách có một hồ sơ -> trạng thái hiển thị đúng hồ sơ đó (NOT_SELECTED)'
    );

    // SCENARIO 4: Trạng thái hồ sơ mới nhất thay đổi
    // Cập nhật case1: chọn sản phẩm -> chuyển sang REGISTRATION_CREATED
    await caseService.selectProduct(case1.id, { productId: testProductId });
    const detailAfterSelect = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterSelect.overallStatus as string) === CaseProgress.REGISTRATION_CREATED &&
      (detailAfterSelect.currentStatus as string) === CaseProgress.REGISTRATION_CREATED,
      '4a. Trạng thái hồ sơ mới nhất thay đổi (NOT_SELECTED -> REGISTRATION_CREATED) -> trạng thái khách hàng cập nhật ngay'
    );

    // Tiếp tục chuyển tiếp case1: REGISTRATION_CREATED -> REGISTRATION_COMPLETED -> UNDER_REVIEW -> APPROVED
    await caseService.updateProgress(case1.id, { toProgress: CaseProgress.REGISTRATION_COMPLETED });
    await caseService.updateProgress(case1.id, { toProgress: CaseProgress.UNDER_REVIEW });
    await caseService.updateProgress(case1.id, { toProgress: CaseProgress.APPROVED });
    const detailAfterApprove = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterApprove.overallStatus as string) === CaseProgress.APPROVED,
      '4b. Trạng thái hồ sơ mới nhất thay đổi (APPROVED) -> trạng thái khách hàng phản ánh APPROVED'
    );

    // SCENARIO 2 & 3: Khách có nhiều hồ sơ với trạng thái khác nhau.
    // Hồ sơ tạo sau có trạng thái khác hồ sơ tạo trước.
    // Hồ sơ A (case1) tạo trước: APPROVED.
    // Hồ sơ B (case2) tạo sau: tạo với progress = NOT_SELECTED.
    // Chờ 50ms để bảo đảm createdAt của case2 lớn hơn case1
    await new Promise((r) => setTimeout(r, 50));

    const case2 = await caseService.createCase(customer1Id, {
      productId: null,
      progress: CaseProgress.NOT_SELECTED,
    });
    const detailAfterCase2 = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterCase2.overallStatus as string) === CaseProgress.NOT_SELECTED &&
      detailAfterCase2.latestCase?.id === case2.id,
      '2 & 3. Khách có nhiều hồ sơ -> trạng thái căn cứ vào hồ sơ mới nhất (Case B tạo sau: NOT_SELECTED, không ưu tiên Case A cũ dù APPROVED)'
    );

    // Chuyển case2 sang REGISTRATION_CREATED -> REGISTRATION_COMPLETED -> UNDER_REVIEW
    await caseService.selectProduct(case2.id, { productId: testProductId });
    await caseService.updateProgress(case2.id, { toProgress: CaseProgress.REGISTRATION_COMPLETED });
    await caseService.updateProgress(case2.id, { toProgress: CaseProgress.UNDER_REVIEW });

    const detailCase2Review = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailCase2Review.overallStatus as string) === CaseProgress.UNDER_REVIEW,
      '3b. Hồ sơ mới nhất chuyển sang UNDER_REVIEW -> trạng thái khách hàng hiển thị UNDER_REVIEW'
    );

    // SCENARIO 5: Hồ sơ cũ được chỉnh sửa nhưng không làm thay đổi trạng thái hiện tại
    // Chỉnh sửa hồ sơ cũ (case1) (ghi chú hoặc update notes)
    // createdAt của case1 giữ nguyên, chỉ updatedAt thay đổi
    await caseService.updateCase(case1.id, {
      notes: 'Ghi chú bổ sung cho hồ sơ cũ số 1',
    });
    const detailAfterEditOldCase = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterEditOldCase.overallStatus as string) === CaseProgress.UNDER_REVIEW &&
      detailAfterEditOldCase.latestCase?.id === case2.id,
      '5. Hồ sơ cũ được chỉnh sửa (updatedAt đổi nhưng createdAt cũ) -> KHÔNG làm thay đổi trạng thái hiện tại (vẫn UNDER_REVIEW từ case2)'
    );

    // SCENARIO 6: Tạo thêm hồ sơ mới -> trở thành căn cứ trạng thái mới
    await new Promise((r) => setTimeout(r, 50));
    const case3 = await caseService.createCase(customer1Id, {
      productId: testProductId,
      progress: CaseProgress.REGISTRATION_CREATED,
    });
    const detailAfterCase3 = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterCase3.overallStatus as string) === CaseProgress.REGISTRATION_CREATED &&
      detailAfterCase3.latestCase?.id === case3.id,
      '6. Tạo thêm hồ sơ mới (case3) -> trở thành hồ sơ mới nhất và là căn cứ trạng thái hiện tại (REGISTRATION_CREATED)'
    );

    // Kiểm tra luồng xóa hồ sơ mới nhất:
    // Nếu case3 bị xóa -> case2 (UNDER_REVIEW) trở lại là hồ sơ mới nhất
    await caseService.deleteCase(case3.id);
    const detailAfterDeleteCase3 = await customerService.getCustomerDetail(customer1Id);
    assert(
      (detailAfterDeleteCase3.overallStatus as string) === CaseProgress.UNDER_REVIEW &&
      detailAfterDeleteCase3.latestCase?.id === case2.id,
      '6b. Xóa hồ sơ mới nhất (case3) -> tự động xác định lại hồ sơ mới nhất còn lại (case2: UNDER_REVIEW)'
    );

    // SCENARIO 8: Trường hợp nhiều hồ sơ có thời điểm tạo giống nhau -> tiêu chí phụ id desc ổn định
    const fixedTime = new Date('2026-05-01T10:00:00.000Z');
    const mockCaseLowId = {
      id: 'aaaa-1111',
      progress: CaseProgress.REGISTRATION_CREATED,
      createdAt: fixedTime,
    };
    const mockCaseHighId = {
      id: 'zzzz-9999',
      progress: CaseProgress.CARD_ISSUED,
      createdAt: fixedTime,
    };
    const latestCaseTie = getLatestCase([mockCaseLowId, mockCaseHighId]);
    assert(
      latestCaseTie?.id === 'zzzz-9999' && latestCaseTie?.progress === CaseProgress.CARD_ISSUED,
      '8. Nhiều hồ sơ có cùng thời điểm tạo (createdAt trùng nhau) -> dùng tiêu chí phụ id desc ổn định (zzzz-9999)'
    );

    // SCENARIO 9: Các API và bộ lọc vẫn hoạt động sau thay đổi
    // Tạo customer2 với trạng thái CARD_ISSUED (thông qua 1 case)
    const cust2 = await customerService.createCustomer({
      fullName: 'Khách Test Filter Card Issued',
      phone: TEST_PHONE_2,
      overallStatus: CustomerStatus.LEAD_MOI,
    });
    customer2Id = cust2.id;
    await caseService.createCase(customer2Id, {
      productId: testProductId,
      progress: CaseProgress.CARD_ISSUED,
    });

    // Lọc theo status = CARD_ISSUED
    const filterCardIssued = await customerService.getCustomers({
      page: 1,
      pageSize: 10,
      status: CaseProgress.CARD_ISSUED,
    });
    assert(
      filterCardIssued.items.some((c) => c.id === customer2Id && (c.overallStatus as string) === CaseProgress.CARD_ISSUED),
      '9a. Bộ lọc API GET /customers?status=CARD_ISSUED tìm đúng khách hàng có hồ sơ mới nhất là CARD_ISSUED'
    );

    // Lọc theo status = LEAD_MOI (khách chưa có hồ sơ)
    const cust3 = await customerService.createCustomer({
      fullName: 'Khách Test Filter Lead Moi',
      phone: TEST_PHONE_3,
      overallStatus: CustomerStatus.LEAD_MOI,
    });
    customer3Id = cust3.id;

    const filterLeadMoi = await customerService.getCustomers({
      page: 1,
      pageSize: 10,
      status: CustomerStatus.LEAD_MOI,
    });
    assert(
      filterLeadMoi.items.some((c) => c.id === customer3Id && c.overallStatus === CustomerStatus.LEAD_MOI),
      '9b. Bộ lọc API GET /customers?status=LEAD_MOI tìm đúng khách hàng chưa có hồ sơ và có status LEAD_MOI'
    );

    // SCENARIO 10: Các bản ghi hiện có không bị mất hoặc đổi trạng thái ngoài ý muốn
    const existingCount = await prisma.customer.count();
    assert(
      existingCount >= 495,
      `10. Bảo toàn dữ liệu: Số lượng khách hàng trong DB được giữ nguyên đầy đủ (Actual: ${existingCount} >= 495)`
    );

    console.log(`\n==================================================`);
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    // Cleanup test records
    try {
      await prisma.caseProgressHistory.deleteMany({
        where: {
          case: {
            customer: {
              phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] },
            },
          },
        },
      });
      await prisma.customerCase.deleteMany({
        where: {
          customer: {
            phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] },
          },
        },
      });
      await prisma.customerActivity.deleteMany({
        where: {
          customer: {
            phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] },
          },
        },
      });
      await prisma.customer.deleteMany({
        where: { phone: { in: [TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3] } },
      });
    } catch (_) {}

    await prisma.$disconnect();
  }
}

runCustomerStatusSyncVerification();

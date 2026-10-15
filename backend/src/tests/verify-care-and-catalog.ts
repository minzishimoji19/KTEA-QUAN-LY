import prisma from '../config/database.js';
import { customerService } from '../services/customer.service.js';
import { caseService } from '../services/case.service.js';
import { followUpService } from '../services/followUp.service.js';
import { customerSourceService } from '../services/customerSource.service.js';
import { productService } from '../services/product.service.js';
import { settingsService } from '../services/settings.service.js';
import { CustomerStatus, CaseProgress, FollowUpStatus, ActivityType } from '@prisma/client';

async function runComprehensiveVerification() {
  console.log('🧪 Starting Comprehensive Verification Suite for Customer Care & Catalog Management...\n');

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

  const TEST_PHONE_CARE = '0977000111';
  const TEST_PHONE_STATUS = '0977000222';
  const TEST_PHONE_CATALOG = '0977000333';

  let testCustCareId = '';
  let testCustStatusId = '';
  let testCustCatalogId = '';
  let testProductId = '';
  let unusedProductId = '';
  let testSourceId = '';
  let unusedSourceId = '';
  const testNeedCode = 'TEST_NEED_UNIQUE_99';
  const unusedNeedCode = 'TEST_NEED_UNUSED_88';

  try {
    // Clean up any test records
    await prisma.followUp.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
    });
    await prisma.caseProgressHistory.deleteMany({
      where: { case: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } } },
    });
    await prisma.customerCase.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
    });
    await prisma.customerNeed.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
    });
    await prisma.customerActivity.deleteMany({
      where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
    });
    await prisma.customer.deleteMany({
      where: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } },
    });

    console.log('--- PHẦN 1: KIỂM THỬ SỐ LẦN CHĂM SÓC & LẦN CHĂM SÓC GẦN NHẤT ---');

    // 1. Khách chưa có lịch sử chăm sóc: số lần = 0, lần chăm sóc gần nhất = null
    const custCare = await customerService.createCustomer({
      fullName: 'Khách Test Chăm Sóc',
      phone: TEST_PHONE_CARE,
      overallStatus: CustomerStatus.LEAD_MOI,
    });
    testCustCareId = custCare.id;

    let custCareDetail = await customerService.getCustomerById(testCustCareId);
    assert(
      custCareDetail.careCount === 0 && custCareDetail.lastCareAt === null,
      '1. Khách chưa có lịch sử chăm sóc -> số lần bằng 0, lần gần nhất là null'
    );

    // 2. Lịch chưa diễn ra (PENDING) không làm tăng số lần chăm sóc
    const pendingFu = await followUpService.createFollowUp({
      customerId: testCustCareId,
      title: 'Lịch hẹn chưa diễn ra',
      dueAt: new Date(Date.now() + 86400000),
      status: FollowUpStatus.PENDING,
      assignedTo: 'Ktea',
    });

    custCareDetail = await customerService.getCustomerById(testCustCareId);
    assert(
      custCareDetail.careCount === 0 && custCareDetail.lastCareAt === null,
      '2. Lịch chưa diễn ra (PENDING) -> không làm tăng số lần chăm sóc (vẫn 0)'
    );

    // 3. Lịch bị hủy (CANCELLED) không làm tăng số lần chăm sóc
    await followUpService.updateFollowUp(pendingFu.id, {
      status: FollowUpStatus.CANCELLED,
    });

    custCareDetail = await customerService.getCustomerById(testCustCareId);
    assert(
      custCareDetail.careCount === 0 && custCareDetail.lastCareAt === null,
      '3. Lịch bị hủy (CANCELLED) -> không làm tăng số lần chăm sóc (vẫn 0)'
    );

    // 4 & 5. Lần chăm sóc hoàn thành (COMPLETED) được tính đúng một lần và hiển thị đúng thời điểm
    const careTime1 = new Date(Date.now() - 3600000 * 2); // 2 hours ago
    const completedFu1 = await followUpService.createFollowUp({
      customerId: testCustCareId,
      title: 'Chăm sóc hoàn thành lần 1',
      dueAt: careTime1,
      status: FollowUpStatus.PENDING,
      assignedTo: 'xoaicaldez',
    });

    await followUpService.updateFollowUp(completedFu1.id, {
      status: FollowUpStatus.COMPLETED,
      completedAt: careTime1,
    });

    custCareDetail = await customerService.getCustomerById(testCustCareId);
    assert(
      custCareDetail.careCount === 1,
      '4. Lần chăm sóc hoàn thành được tính đúng một lần (careCount === 1)'
    );
    assert(
      custCareDetail.lastCareAt !== null &&
      new Date(custCareDetail.lastCareAt).getTime() === careTime1.getTime(),
      '5. Lần chăm sóc gần nhất hiển thị đúng thời điểm hoàn thành'
    );

    // 6. Sửa thông tin khách hàng không làm thay đổi thời điểm chăm sóc gần nhất
    await new Promise((r) => setTimeout(r, 50));
    await customerService.updateCustomer(testCustCareId, {
      fullName: 'Khách Test Chăm Sóc Đã Sửa Tên',
    });

    custCareDetail = await customerService.getCustomerById(testCustCareId);
    assert(
      custCareDetail.lastCareAt !== null &&
      new Date(custCareDetail.lastCareAt).getTime() === careTime1.getTime(),
      '6. Sửa thông tin khách hàng (updatedAt đổi) -> KHÔNG làm thay đổi thời điểm chăm sóc gần nhất'
    );

    // 7. Hoàn thành thêm lần chăm sóc thứ 2 và kiểm tra không đếm trùng với CustomerActivity
    const careTime2 = new Date(Date.now() - 1800000); // 30 mins ago
    const completedFu2 = await followUpService.createFollowUp({
      customerId: testCustCareId,
      title: 'Chăm sóc hoàn thành lần 2',
      dueAt: careTime2,
      status: FollowUpStatus.COMPLETED,
      assignedTo: 'mfast',
    });
    // Ensure completedAt is careTime2
    await prisma.followUp.update({
      where: { id: completedFu2.id },
      data: { completedAt: careTime2 },
    });

    // Check that CustomerActivity has additional SYSTEM_EVENT logs
    const activitiesCount = await prisma.customerActivity.count({
      where: { customerId: testCustCareId },
    });
    assert(
      activitiesCount >= 4,
      '7a. Hệ thống có ghi nhận CustomerActivity logs tương ứng'
    );

    // Query customers list via getCustomers (simulating customer table)
    const listResult = await customerService.getCustomers({
      page: 1,
      pageSize: 10,
      search: TEST_PHONE_CARE,
    });
    const foundCustomer = listResult.items.find((c) => c.id === testCustCareId);
    assert(
      foundCustomer !== undefined &&
      foundCustomer.careCount === 2 &&
      foundCustomer.lastCareAt !== null &&
      new Date(foundCustomer.lastCareAt).getTime() === careTime2.getTime(),
      '7b. Không đếm trùng: Danh sách khách hàng hiển thị đúng 2 lần chăm sóc và thời điểm của lần 2'
    );

    console.log('\n--- PHẦN 3: KIỂM THỬ ĐỒNG BỘ TRẠNG THÁI HỒ SƠ MỚI NHẤT ---');

    // Setup product for case tests
    let existingProd = await prisma.product.findFirst({ where: { active: true } });
    if (!existingProd) {
      existingProd = await prisma.product.create({
        data: { code: 'SYNC_TEST_P1', name: 'Sản phẩm Test Thẻ', active: true },
      });
    }
    testProductId = existingProd.id;

    // 1. Khách chỉ có một hồ sơ -> trạng thái hiển thị đúng hồ sơ đó
    const custStatus = await customerService.createCustomer({
      fullName: 'Khách Test Trạng Thái',
      phone: TEST_PHONE_STATUS,
      overallStatus: CustomerStatus.LEAD_MOI,
    });
    testCustStatusId = custStatus.id;

    const caseA = await caseService.createCase(testCustStatusId, {
      productId: testProductId,
      progress: CaseProgress.REGISTRATION_CREATED,
    });

    let custStatusDetail = await customerService.getCustomerById(testCustStatusId);
    assert(
      (custStatusDetail.overallStatus as string) === CaseProgress.REGISTRATION_CREATED,
      '1. Khách có 1 hồ sơ -> hiển thị đúng trạng thái hồ sơ (REGISTRATION_CREATED)'
    );

    // 2. Cập nhật hồ sơ mới nhất -> trạng thái thay đổi tương ứng
    await caseService.updateProgress(caseA.id, { toProgress: CaseProgress.REGISTRATION_COMPLETED });
    await caseService.updateProgress(caseA.id, { toProgress: CaseProgress.UNDER_REVIEW });
    await caseService.updateProgress(caseA.id, { toProgress: CaseProgress.APPROVED });
    custStatusDetail = await customerService.getCustomerById(testCustStatusId);
    assert(
      (custStatusDetail.overallStatus as string) === CaseProgress.APPROVED,
      '2. Cập nhật hồ sơ mới nhất (APPROVED) -> trạng thái khách hàng cập nhật APPROVED'
    );

    // 3. Tạo hồ sơ mới -> căn cứ vào hồ sơ mới nhất
    await new Promise((r) => setTimeout(r, 50));
    const caseB = await caseService.createCase(testCustStatusId, {
      productId: null,
      progress: CaseProgress.NOT_SELECTED,
    });

    custStatusDetail = await customerService.getCustomerById(testCustStatusId);
    assert(
      (custStatusDetail.overallStatus as string) === CaseProgress.NOT_SELECTED &&
      custStatusDetail.latestCase?.id === caseB.id,
      '3. Tạo hồ sơ mới (caseB tạo sau) -> trạng thái căn cứ hồ sơ mới nhất (NOT_SELECTED, không giữ APPROVED cũ)'
    );

    // 4. Cập nhật hồ sơ cũ -> KHÔNG ghi đè trạng thái hiện tại
    await caseService.updateCase(caseA.id, { notes: 'Cập nhật ghi chú cho case cũ' });
    custStatusDetail = await customerService.getCustomerById(testCustStatusId);
    assert(
      (custStatusDetail.overallStatus as string) === CaseProgress.NOT_SELECTED &&
      custStatusDetail.latestCase?.id === caseB.id,
      '4. Chỉnh sửa hồ sơ cũ (caseA) -> KHÔNG làm thay đổi trạng thái hiện tại (vẫn NOT_SELECTED từ caseB)'
    );

    console.log('\n--- PHẦN 4: KIỂM THỬ XÓA DANH MỤC VÀ BẢO VỆ DỮ LIỆU ---');

    // 1. Nguồn khách hàng: Xóa nguồn chưa sử dụng -> thành công
    const newSource = await customerSourceService.createSource({
      name: `Nguồn Test Tạm ${Date.now()}`,
      active: true,
    });
    unusedSourceId = newSource.id;

    await customerSourceService.deleteSource(unusedSourceId);
    const checkDeletedSource = await prisma.customerSource.findUnique({ where: { id: unusedSourceId } });
    assert(
      checkDeletedSource === null,
      '1. Xóa nguồn khách hàng chưa được sử dụng -> thành công'
    );

    // 2. Nguồn khách hàng: Thử xóa nguồn đang được tham chiếu -> từ chối xóa an toàn
    const inUseSource = await customerSourceService.createSource({
      name: `Nguồn Đang Sử Dụng ${Date.now()}`,
      active: true,
    });
    testSourceId = inUseSource.id;

    const custCatalog = await customerService.createCustomer({
      fullName: 'Khách Test Catalog',
      phone: TEST_PHONE_CATALOG,
      sourceId: testSourceId,
      overallStatus: CustomerStatus.LEAD_MOI,
    });
    testCustCatalogId = custCatalog.id;

    let sourceDeleteRejected = false;
    let sourceErrorMsg = '';
    try {
      await customerSourceService.deleteSource(testSourceId);
    } catch (err: any) {
      sourceDeleteRejected = true;
      sourceErrorMsg = err.message;
    }
    assert(
      sourceDeleteRejected && sourceErrorMsg.includes('liên kết'),
      '2. Thử xóa nguồn đang được khách hàng tham chiếu -> bị từ chối xóa an toàn với lý do rõ ràng'
    );

    // 3. Sản phẩm: Xóa sản phẩm chưa sử dụng -> thành công
    const newProd = await productService.createProduct({
      code: `PROD_TEMP_${Date.now()}`,
      name: 'Sản phẩm thử nghiệm chưa dùng',
      active: true,
    });
    unusedProductId = newProd.id;

    await productService.deleteProduct(unusedProductId);
    const checkDeletedProd = await prisma.product.findUnique({ where: { id: unusedProductId } });
    assert(
      checkDeletedProd === null,
      '3. Xóa sản phẩm chưa được sử dụng -> thành công'
    );

    // 4. Sản phẩm: Thử xóa sản phẩm đang có hồ sơ khách hàng -> từ chối xóa an toàn
    let prodDeleteRejected = false;
    let prodErrorMsg = '';
    try {
      await productService.deleteProduct(testProductId);
    } catch (err: any) {
      prodDeleteRejected = true;
      prodErrorMsg = err.message;
    }
    assert(
      prodDeleteRejected && prodErrorMsg.includes('hồ sơ khách hàng'),
      '4. Thử xóa sản phẩm đang có hồ sơ liên kết -> bị từ chối xóa an toàn với lý do rõ ràng'
    );

    // 5. Nhóm nhu cầu: Xóa nhóm nhu cầu chưa sử dụng -> thành công
    const settingsBefore = await settingsService.getSettings();
    await settingsService.updateNeedCategories([
      ...settingsBefore.needCategories,
      {
        code: unusedNeedCode,
        label: 'Nhóm nhu cầu test chưa dùng',
        description: 'Mô tả test',
        active: true,
      },
      {
        code: testNeedCode,
        label: 'Nhóm nhu cầu test đang dùng',
        description: 'Mô tả test đang dùng',
        active: true,
      },
    ]);

    await settingsService.deleteNeedCategory(unusedNeedCode);
    const settingsAfterUnusedDelete = await settingsService.getSettings();
    assert(
      !settingsAfterUnusedDelete.needCategories.some((c) => c.code === unusedNeedCode),
      '5. Xóa nhóm nhu cầu chưa sử dụng -> thành công'
    );

    // 6. Nhóm nhu cầu: Thử xóa nhóm nhu cầu đang được tham chiếu bởi CustomerNeed -> từ chối xóa an toàn
    await prisma.customerNeed.create({
      data: {
        customerId: testCustCatalogId,
        needType: testNeedCode,
        notes: 'Ghi nhận nhu cầu test',
      },
    });

    let needDeleteRejected = false;
    let needErrorMsg = '';
    try {
      await settingsService.deleteNeedCategory(testNeedCode);
    } catch (err: any) {
      needDeleteRejected = true;
      needErrorMsg = err.message;
    }
    assert(
      needDeleteRejected && needErrorMsg.includes('nhu cầu khách hàng'),
      '6. Thử xóa nhóm nhu cầu đang được tham chiếu bởi CustomerNeed -> bị từ chối xóa an toàn'
    );

    // 7. Bảo toàn toàn vẹn dữ liệu: Khách hàng, hồ sơ, nhu cầu và nguồn vẫn nguyên vẹn
    const custStillExists = await prisma.customer.findUnique({ where: { id: testCustCatalogId } });
    const needStillExists = await prisma.customerNeed.findFirst({ where: { customerId: testCustCatalogId } });
    const prodStillExists = await prisma.product.findUnique({ where: { id: testProductId } });
    const sourceStillExists = await prisma.customerSource.findUnique({ where: { id: testSourceId } });

    assert(
      custStillExists !== null && needStillExists !== null && prodStillExists !== null && sourceStillExists !== null,
      '7. Bảo toàn dữ liệu: Khách hàng, hồ sơ, nhu cầu, sản phẩm và nguồn vẫn nguyên vẹn 100%'
    );

  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  } finally {
    // Clean up test data safely
    try {
      await prisma.followUp.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
      });
      await prisma.caseProgressHistory.deleteMany({
        where: { case: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } } },
      });
      await prisma.customerCase.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
      });
      await prisma.customerNeed.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
      });
      await prisma.customerActivity.deleteMany({
        where: { customer: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } } },
      });
      await prisma.customer.deleteMany({
        where: { phone: { in: [TEST_PHONE_CARE, TEST_PHONE_STATUS, TEST_PHONE_CATALOG] } },
      });
      if (testSourceId) {
        await prisma.customerSource.delete({ where: { id: testSourceId } }).catch(() => {});
      }
      const finalSettings = await settingsService.getSettings();
      const cleanedNeeds = finalSettings.needCategories.filter(
        (c) => c.code !== testNeedCode && c.code !== unusedNeedCode
      );
      await settingsService.updateNeedCategories(cleanedNeeds);
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  }

  console.log(`\n==================================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveVerification();

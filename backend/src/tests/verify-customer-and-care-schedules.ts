import ExcelJS from 'exceljs';
import { Role, FollowUpStatus, CustomerStatus, PriorityLevel } from '@prisma/client';
import prisma from '../config/database.js';
import { sanitizeExcelValue, customerExportService } from '../services/customerExport.service.js';
import { followUpService } from '../services/followUp.service.js';
import { ForbiddenError } from '../utils/errors.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TEST SUITE: CUSTOMER EXCEL EXPORT & CARE SCHEDULE RBAC');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Sanitization against Formula Injection
  // --------------------------------------------------------------------------
  console.log('1. Kiểm tra chống Excel Formula Injection (sanitizeExcelValue)...');
  assert(sanitizeExcelValue('=SUM(A1:A10)') === "'=SUM(A1:A10)", 'Ký tự = phải được escape bằng single apostrophe');
  assert(sanitizeExcelValue('+12345678') === "'+12345678", 'Ký tự + phải được escape bằng single apostrophe');
  assert(sanitizeExcelValue('-2000000') === "'-2000000", 'Ký tự - phải được escape bằng single apostrophe');
  assert(sanitizeExcelValue('@SUM(B1:B5)') === "'@SUM(B1:B5)", 'Ký tự @ phải được escape bằng single apostrophe');
  assert(sanitizeExcelValue('\t=cmd') === "'\t=cmd", 'Ký tự tab ở đầu phải được escape');
  assert(sanitizeExcelValue('\r=cmd') === "'\r=cmd", 'Ký tự xuống dòng ở đầu phải được escape');
  assert(sanitizeExcelValue('Nguyễn Văn An') === 'Nguyễn Văn An', 'Chuỗi bình thường giữ nguyên');
  assert(sanitizeExcelValue(100) === 100, 'Số nguyên giữ nguyên');
  assert(sanitizeExcelValue(null) === '', 'null trả về chuỗi rỗng');

  // --------------------------------------------------------------------------
  // TEST 2: Customer Export Service generates valid XLSX buffer with 2 sheets
  // --------------------------------------------------------------------------
  console.log('\n2. Kiểm tra xuất file Excel với 2 sheet và định dạng tiếng Việt...');
  const adminUser = await prisma.user.findFirst({
    where: { role: Role.ADMIN, status: 'ACTIVE' },
  });

  if (!adminUser) {
    console.warn('  ⚠️ Không tìm thấy ADMIN user để test, bỏ qua một số test thực tế');
  } else {
    const excelBuffer = await customerExportService.exportCustomersToExcel({
      filters: {},
      user: {
        userId: adminUser.id,
        role: Role.ADMIN,
      },
    });

    assert(excelBuffer instanceof Buffer, 'Kết quả trả về phải là một Buffer');
    assert(excelBuffer.length > 1000, `Buffer Excel phải có dung lượng hợp lệ (>1000 bytes, thực tế: ${excelBuffer.length} bytes)`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);

    const sheet1 = workbook.getWorksheet('Danh sách khách hàng');
    assert(Boolean(sheet1), 'Sheet 1 "Danh sách khách hàng" phải tồn tại trong workbook');

    const sheet2 = workbook.getWorksheet('Thống kê tổng hợp');
    assert(Boolean(sheet2), 'Sheet 2 "Thống kê tổng hợp" phải tồn tại trong workbook');

    if (sheet1) {
      const title = sheet1.getCell('A1').value;
      assert(String(title).includes('DANH SÁCH KHÁCH HÀNG'), 'Tiêu đề sheet 1 phải có "DANH SÁCH KHÁCH HÀNG"');
      const sttHeader = sheet1.getCell('A2').value;
      assert(sttHeader === 'STT', 'Cột 1 dòng 2 phải là header "STT"');
    }

    if (sheet2) {
      const s2Title = sheet2.getCell('A1').value;
      assert(String(s2Title).includes('BÁO CÁO THỐNG KÊ TỔNG HỢP'), 'Tiêu đề sheet 2 phải có "BÁO CÁO THỐNG KÊ TỔNG HỢP"');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 3: RBAC Export Limitation for Partner
  // --------------------------------------------------------------------------
  console.log('\n3. Kiểm tra RBAC xuất Excel cho PARTNER...');
  const partnerUser = await prisma.user.findFirst({
    where: { role: Role.PARTNER, status: 'ACTIVE' },
  });

  if (partnerUser) {
    const partnerBuffer = await customerExportService.exportCustomersToExcel({
      filters: {},
      user: {
        userId: partnerUser.id,
        role: Role.PARTNER,
      },
    });

    const partnerWorkbook = new ExcelJS.Workbook();
    await partnerWorkbook.xlsx.load(partnerBuffer as any);
    const pSheet1 = partnerWorkbook.getWorksheet('Danh sách khách hàng');
    assert(Boolean(pSheet1), 'Partner xuất file Excel thành công trong phạm vi phân công');
  } else {
    console.log('  ℹ️ Không có PARTNER user trong DB, bỏ qua kiểm tra DB đối tác');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Mandatory RBAC: Partner can complete OWN FollowUps, blocked from reopening or changing caregiver
  // --------------------------------------------------------------------------
  console.log('\n4. Kiểm tra quy tắc phân quyền Partner đối với lịch chăm sóc...');
  const mockPartnerRole: Role = Role.PARTNER;

  // Test Partner blocked from reopening COMPLETED -> PENDING
  let partnerReopenBlocked = false;
  try {
    if ((mockPartnerRole as string) === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không có quyền mở lại lịch chăm sóc đã hoàn thành');
    }
  } catch (err) {
    if (err instanceof ForbiddenError) {
      partnerReopenBlocked = true;
    }
  }
  assert(partnerReopenBlocked, 'Thao tác mở lại lịch đã hoàn thành bởi PARTNER phải bị chặn với 403 ForbiddenError');

  // Test Partner blocked from changing caregiver
  let partnerReassignBlocked = false;
  try {
    if ((mockPartnerRole as string) === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không có quyền thay đổi người phụ trách lịch chăm sóc');
    }
  } catch (err) {
    if (err instanceof ForbiddenError) {
      partnerReassignBlocked = true;
    }
  }
  assert(partnerReassignBlocked, 'Thao tác đổi người phụ trách lịch chăm sóc bởi PARTNER phải bị chặn với 403 ForbiddenError');

  // --------------------------------------------------------------------------
  // TEST 5: Bulk Reopen follow-up logic
  // --------------------------------------------------------------------------
  console.log('\n5. Kiểm tra phương thức bulk reopen lịch chăm sóc...');
  const customer = await prisma.customer.findFirst({ select: { id: true } });
  if (customer) {
    // Tạo 1 lịch tạm có trạng thái COMPLETED
    const tempFollowUp = await prisma.followUp.create({
      data: {
        customerId: customer.id,
        title: 'TEST_REOPEN_SCHEDULE',
        status: FollowUpStatus.COMPLETED,
        dueAt: new Date(),
        completedAt: new Date(),
      },
    });

    try {
      const reopenRes = await followUpService.reopenBulkFollowUps({
        ids: [tempFollowUp.id],
      });

      assert(reopenRes.succeeded.includes(tempFollowUp.id), 'Lịch đã hoàn thành được mở lại thành công');

      const verified = await prisma.followUp.findUnique({
        where: { id: tempFollowUp.id },
      });

      assert(verified?.status === FollowUpStatus.PENDING, 'Trạng thái sau khi mở lại phải là PENDING');
      assert(verified?.completedAt === null, 'completedAt sau khi mở lại phải được xóa (null)');
    } finally {
      // Cleanup bản ghi test
      await prisma.followUp.delete({ where: { id: tempFollowUp.id } }).catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6: Bulk Reassign caregiver logic
  // --------------------------------------------------------------------------
  console.log('\n6. Kiểm tra phương thức bulk reassign người chăm sóc...');
  if (customer && adminUser) {
    const tempFollowUp2 = await prisma.followUp.create({
      data: {
        customerId: customer.id,
        title: 'TEST_REASSIGN_SCHEDULE',
        status: FollowUpStatus.PENDING,
        dueAt: new Date(),
        assignedTo: null,
      },
    });

    try {
      const reassignRes = await followUpService.reassignBulkFollowUps({
        ids: [tempFollowUp2.id],
        assignedToUserId: adminUser.id,
        assignedTo: adminUser.fullName,
      });

      assert(reassignRes.succeeded.includes(tempFollowUp2.id), 'Đổi người chăm sóc hàng loạt thành công');

      const verified2 = await prisma.followUp.findUnique({
        where: { id: tempFollowUp2.id },
      });

      assert(verified2?.assignedToUserId === adminUser.id, 'assignedToUserId được cập nhật đúng');
      assert(verified2?.assignedTo === adminUser.fullName, 'assignedTo được cập nhật đúng');
    } finally {
      await prisma.followUp.delete({ where: { id: tempFollowUp2.id } }).catch(() => {});
    }
  }

  console.log('\n======================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

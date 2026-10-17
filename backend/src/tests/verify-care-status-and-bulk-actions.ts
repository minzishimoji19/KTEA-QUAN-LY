import assert from 'assert';
import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, UserStatus, FollowUpStatus } from '@prisma/client';
import { createApp } from '../app.js';
import { userService } from '../services/user.service.js';

const prisma = new PrismaClient();

async function runTests() {
  console.log('========================================================================');
  console.log('=== KTEA CRM: VERIFY CARE STATUS & BULK ACTIONS (REQ 1 & REQ 2) ===');
  console.log('========================================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`- Ephemeral HTTP test server running at ${baseUrl}`);

  const api = (
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      cookie?: string;
    } = {}
  ): Promise<{ status: number; ok: boolean; body: any; cookie: string }> => {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, baseUrl);
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-KTEA-REQUEST': '1',
        ...(options.headers || {}),
      };
      if (options.cookie) {
        reqHeaders['Cookie'] = options.cookie;
      }

      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: reqHeaders,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            let parsed: any;
            try {
              parsed = JSON.parse(rawData);
            } catch {
              parsed = rawData;
            }
            const rawCookieHeader = res.headers['set-cookie'];
            let sessionCookie = '';
            if (rawCookieHeader) {
              const cookies = Array.isArray(rawCookieHeader) ? rawCookieHeader : [rawCookieHeader];
              for (const c of cookies) {
                const match = c.match(/ktea_session=[^;]+/);
                if (match) {
                  sessionCookie = match[0];
                  break;
                }
              }
            }
            const status = res.statusCode || 500;
            resolve({
              status,
              ok: status >= 200 && status < 300,
              body: parsed,
              cookie: sessionCookie,
            });
          });
        }
      );

      req.on('error', reject);
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  };

  const timestamp = Date.now();
  const testPassword = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  let adminUser: any = null;
  let partnerUserA: any = null;
  let partnerUserB: any = null;
  let testCust1Id: string | null = null;
  let testCust2Id: string | null = null;
  let testFollowUp1Id: string | null = null;
  let testFollowUp2Id: string | null = null;

  try {
    // 1. Setup ephemeral test users
    adminUser = await prisma.user.create({
      data: {
        email: `care_admin_${timestamp}@example.com`,
        fullName: `Care Admin ${timestamp}`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    partnerUserA = await prisma.user.create({
      data: {
        email: `care_partner_a_${timestamp}@example.com`,
        fullName: `Care Partner A ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    partnerUserB = await prisma.user.create({
      data: {
        email: `care_partner_b_${timestamp}@example.com`,
        fullName: `Care Partner B ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    // 2. Authenticate Admin and Partner
    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: adminUser.email, password: testPassword },
    });
    assert(adminLogin.ok, `Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    const adminCookie = adminLogin.cookie;
    const adminToken = adminLogin.body?.data?.token;
    const adminHeaders: Record<string, string> = {
      ...(adminCookie ? { Cookie: adminCookie } : {}),
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    };

    const partnerLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerUserA.email, password: testPassword },
    });
    assert(partnerLogin.ok, `Partner login failed: ${JSON.stringify(partnerLogin.body)}`);
    const partnerCookie = partnerLogin.cookie;
    const partnerToken = partnerLogin.body?.data?.token;
    const partnerHeaders: Record<string, string> = {
      ...(partnerCookie ? { Cookie: partnerCookie } : {}),
      ...(partnerToken ? { Authorization: `Bearer ${partnerToken}` } : {}),
    };

    // -------------------------------------------------------------------------
    // TEST 1: KIỂM CHỨNG HIỂN THỊ SỐ LẦN CHĂM SÓC VÀ TRẠNG THÁI (YÊU CẦU 1)
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Kiểm chứng Số lần chăm sóc và trạng thái màu theo chu kỳ...');

    // 1.1 Khách hàng mới tạo -> careCount = 0, latestCareStatus = NONE
    const cust1 = await prisma.customer.create({
      data: {
        fullName: `Khách Test Chăm Sóc Req1 ${timestamp}`,
        phone: `09811${String(timestamp).slice(-5)}`,
      },
    });
    testCust1Id = cust1.id;

    let resCust1 = await api(`/api/customers/${testCust1Id}`, { headers: adminHeaders });
    assert.strictEqual(resCust1.body.data.careCount, 0, 'Khách mới tạo phải có careCount === 0');
    assert.strictEqual(resCust1.body.data.latestCareStatus, 'NONE', 'Khách mới tạo phải có latestCareStatus === NONE');

    // 1.2 Tạo 1 lịch chăm sóc chưa diễn ra (PENDING)
    const futureDate = new Date(Date.now() + 86400000 * 2); // 2 days in future
    const fu1 = await prisma.followUp.create({
      data: {
        customerId: testCust1Id,
        title: 'Lịch gọi tư vấn gói vay tiêu dùng',
        dueAt: futureDate,
        status: FollowUpStatus.PENDING,
        assignedToUserId: partnerUserA.id,
        assignedTo: partnerUserA.fullName,
      },
    });
    testFollowUp1Id = fu1.id;

    resCust1 = await api(`/api/customers/${testCust1Id}`, { headers: adminHeaders });
    console.log(`  * Sau khi tạo lịch PENDING: careCount=${resCust1.body.data.careCount}, status=${resCust1.body.data.latestCareStatus}`);
    assert.strictEqual(resCust1.body.data.careCount, 1, 'Khi có lịch chăm sóc, careCount phải hiển thị 1 lần');
    assert.strictEqual(resCust1.body.data.latestCareStatus, 'PENDING', 'Trạng thái phải là PENDING (màu đỏ)');

    // 1.3 Tạo lịch quá hạn (OVERDUE)
    const pastDate = new Date(Date.now() - 86400000 * 2); // 2 days in past
    await prisma.followUp.update({
      where: { id: testFollowUp1Id },
      data: { dueAt: pastDate },
    });

    resCust1 = await api(`/api/customers/${testCust1Id}`, { headers: adminHeaders });
    console.log(`  * Khi lịch bị quá hạn: careCount=${resCust1.body.data.careCount}, status=${resCust1.body.data.latestCareStatus}`);
    assert.strictEqual(resCust1.body.data.careCount, 1, 'Số lần vẫn là 1');
    assert.strictEqual(resCust1.body.data.latestCareStatus, 'OVERDUE', 'Trạng thái quá hạn phải là OVERDUE (màu đỏ đậm)');

    // 1.4 Đánh dấu hoàn thành -> số lần KHÔNG TĂNG, trạng thái sang COMPLETED (màu xanh lá)
    await prisma.followUp.update({
      where: { id: testFollowUp1Id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    resCust1 = await api(`/api/customers/${testCust1Id}`, { headers: adminHeaders });
    console.log(`  * Sau khi đánh dấu hoàn thành: careCount=${resCust1.body.data.careCount}, status=${resCust1.body.data.latestCareStatus}`);
    assert.strictEqual(resCust1.body.data.careCount, 1, 'Số lần chăm sóc thực tế không được tăng lên khi chỉ cập nhật trạng thái');
    assert.strictEqual(resCust1.body.data.latestCareStatus, 'COMPLETED', 'Trạng thái phải cập nhật sang COMPLETED (màu xanh lá)');
    assert(resCust1.body.data.lastCareAt !== null, 'lastCareAt phải được ghi nhận thời điểm hoàn thành');

    // 1.5 Tạo thêm lần chăm sóc thứ 2 (PENDING) -> careCount tăng lên 2
    const fu2 = await prisma.followUp.create({
      data: {
        customerId: testCust1Id,
        title: 'Chăm sóc lần 2: Nhắc hạn giải ngân',
        dueAt: new Date(Date.now() + 86400000 * 5),
        status: FollowUpStatus.PENDING,
        assignedToUserId: partnerUserA.id,
        assignedTo: partnerUserA.fullName,
      },
    });
    testFollowUp2Id = fu2.id;

    resCust1 = await api(`/api/customers/${testCust1Id}`, { headers: adminHeaders });
    console.log(`  * Sau khi tạo lần 2: careCount=${resCust1.body.data.careCount}, completed=${resCust1.body.data.completedCareCount}, pending=${resCust1.body.data.pendingCareCount}`);
    assert.strictEqual(resCust1.body.data.careCount, 2, 'Tổng số lần chăm sóc phải là 2');
    assert.strictEqual(resCust1.body.data.completedCareCount, 1, 'Số lần hoàn thành phải là 1');
    assert.strictEqual(resCust1.body.data.pendingCareCount, 1, 'Số lần chưa hoàn thành phải là 1');
    assert.strictEqual(resCust1.body.data.careFollowUps.length, 2, 'Phải có chi tiết 2 lần chăm sóc');

    console.log('✓ TEST 1 PASSED: Care count và color status hoạt động chuẩn xác theo nghiệp vụ.\n');

    // -------------------------------------------------------------------------
    // TEST 2: ĐỔI NGƯỜI CHĂM SÓC HÀNG LOẠT (YÊU CẦU 2 - PHẦN C)
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Đổi người chăm sóc hàng loạt...');

    const cust2 = await prisma.customer.create({
      data: {
        fullName: `Khách Test Chăm Sóc Req2 ${timestamp}`,
        phone: `09822${String(timestamp).slice(-5)}`,
      },
    });
    testCust2Id = cust2.id;

    // Phân công cust1 và cust2 cho partnerUserA ban đầu
    await userService.assignCustomers(
      { id: adminUser.id, email: adminUser.email },
      partnerUserA.id,
      [testCust1Id, testCust2Id],
      'Giao ban đầu'
    );

    // Chuyển hàng loạt từ partnerUserA sang partnerUserB
    const reassignRes = await api('/api/users/bulk-reassign', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        fromUserId: partnerUserA.id,
        toUserId: partnerUserB.id,
        customerIds: [testCust1Id, testCust2Id],
        notes: 'Chuyển giao hàng loạt sang partner B',
      },
    });

    assert(reassignRes.ok, `Bulk reassign failed: ${JSON.stringify(reassignRes.body)}`);
    assert.strictEqual(reassignRes.body.data.total, 2, 'Total reassign requested phải là 2');
    assert.strictEqual(reassignRes.body.data.succeeded.length, 2, 'Cả 2 khách hàng phải chuyển giao thành công');

    // Kiểm tra partnerUserB đã có 2 khách hàng này trong assignments
    const partnerBAssignments = await api(`/api/users/${partnerUserB.id}/assignments`, { headers: adminHeaders });
    const bCustomerIds = partnerBAssignments.body.data.map((a: any) => a.customerId);
    assert(bCustomerIds.includes(testCust1Id), 'Khách 1 phải thuộc partnerUserB');
    assert(bCustomerIds.includes(testCust2Id), 'Khách 2 phải thuộc partnerUserB');

    // Kiểm tra partnerUserA không còn 2 khách hàng này
    const partnerAAssignments = await api(`/api/users/${partnerUserA.id}/assignments`, { headers: adminHeaders });
    const aCustomerIds = partnerAAssignments.body.data.map((a: any) => a.customerId);
    assert(!aCustomerIds.includes(testCust1Id), 'Khách 1 không còn thuộc partnerUserA');
    assert(!aCustomerIds.includes(testCust2Id), 'Khách 2 không còn thuộc partnerUserA');

    // Kiểm tra lịch chăm sóc đang mở (fu2) đã được cập nhật assignedTo sang partnerUserB
    const updatedFu2 = await prisma.followUp.findUnique({ where: { id: testFollowUp2Id } });
    assert.strictEqual(updatedFu2?.assignedToUserId, partnerUserB.id, 'Follow-up đang mở phải đổi assignedToUserId sang partnerUserB');
    assert.strictEqual(updatedFu2?.assignedTo, partnerUserB.fullName, 'Follow-up đang mở phải đổi assignedTo sang partnerUserB.fullName');

    // Kiểm tra lịch chăm sóc đã hoàn thành (fu1) KHÔNG BỊ SỬA LỊCH SỬ
    const originalFu1 = await prisma.followUp.findUnique({ where: { id: testFollowUp1Id } });
    assert.strictEqual(originalFu1?.status, FollowUpStatus.COMPLETED, 'Lịch đã hoàn thành phải giữ nguyên COMPLETED');

    console.log('✓ TEST 2 PASSED: Đổi người chăm sóc hàng loạt bảo toàn lịch sử và chuyển giao chính xác.\n');

    // -------------------------------------------------------------------------
    // TEST 3: HỦY PHÂN CÔNG HÀNG LOẠT (YÊU CẦU 2 - PHẦN B)
    // -------------------------------------------------------------------------
    console.log('[TEST 3] Hủy phân công hàng loạt...');

    const bulkUnassignRes = await api('/api/users/bulk-unassign', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        partnerUserId: partnerUserB.id,
        customerIds: [testCust1Id, testCust2Id],
        sourceType: 'ALL',
      },
    });

    assert(bulkUnassignRes.ok, `Bulk unassign failed: ${JSON.stringify(bulkUnassignRes.body)}`);
    assert.strictEqual(bulkUnassignRes.body.data.total, 2, 'Total unassign requested phải là 2');
    assert.strictEqual(bulkUnassignRes.body.data.succeeded.length, 2, 'Cả 2 khách hàng phải hủy thành công');

    // Xác nhận partnerUserB không còn khách nào
    const finalAssignments = await api(`/api/users/${partnerUserB.id}/assignments`, { headers: adminHeaders });
    const finalIds = finalAssignments.body.data.map((a: any) => a.customerId);
    assert(!finalIds.includes(testCust1Id), 'Khách 1 không còn trong assignments của partnerUserB');
    assert(!finalIds.includes(testCust2Id), 'Khách 2 không còn trong assignments của partnerUserB');

    // Xác nhận database: KHÁCH HÀNG VÀ LỊCH CHĂM SÓC KHÔNG BỊ XÓA
    const stillExistsCust1 = await prisma.customer.findUnique({ where: { id: testCust1Id } });
    assert(stillExistsCust1 !== null, 'Khách hàng 1 TUYỆT ĐỐI không bị xóa khỏi database');
    const stillExistsCust2 = await prisma.customer.findUnique({ where: { id: testCust2Id } });
    assert(stillExistsCust2 !== null, 'Khách hàng 2 TUYỆT ĐỐI không bị xóa khỏi database');

    const preservedFu1 = await prisma.followUp.findUnique({ where: { id: testFollowUp1Id } });
    assert(preservedFu1 !== null, 'Lịch chăm sóc fu1 TUYỆT ĐỐI không bị xóa');
    const preservedFu2 = await prisma.followUp.findUnique({ where: { id: testFollowUp2Id } });
    assert(preservedFu2 !== null, 'Lịch chăm sóc fu2 TUYỆT ĐỐI không bị xóa');

    console.log('✓ TEST 3 PASSED: Hủy phân công hàng loạt thu hồi quyền an toàn, bảo toàn 100% dữ liệu.\n');

    // -------------------------------------------------------------------------
    // TEST 4: BẢO VỆ PHÂN QUYỀN RBAC (PARTNER BỊ CHẶN 403)
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Kiểm tra bảo vệ RBAC: PARTNER bị chặn 403 khi gọi API hàng loạt...');

    const partnerUnassignAttempt = await api('/api/users/bulk-unassign', {
      method: 'POST',
      headers: partnerHeaders,
      body: {
        partnerUserId: partnerUserB.id,
        customerIds: [testCust1Id],
      },
    });
    assert.strictEqual(partnerUnassignAttempt.status, 403, 'Partner phải bị từ chối 403 khi gọi bulk-unassign');

    const partnerReassignAttempt = await api('/api/users/bulk-reassign', {
      method: 'POST',
      headers: partnerHeaders,
      body: {
        toUserId: partnerUserA.id,
        customerIds: [testCust1Id],
      },
    });
    assert.strictEqual(partnerReassignAttempt.status, 403, 'Partner phải bị từ chối 403 khi gọi bulk-reassign');

    console.log('✓ TEST 4 PASSED: RBAC ngăn chặn triệt để hành vi thao tác hàng loạt trái quyền.\n');

  } catch (err: any) {
    console.error('*** ASSERTION / RUNTIME ERROR IN TEST SUITE ***:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    throw err;
  } finally {
    // Cleanup test records
    console.log('[CLEANUP] Dọn dẹp bản ghi kiểm thử an toàn...');
    if (testFollowUp1Id) await prisma.followUp.delete({ where: { id: testFollowUp1Id } }).catch(() => {});
    if (testFollowUp2Id) await prisma.followUp.delete({ where: { id: testFollowUp2Id } }).catch(() => {});
    if (testCust1Id) {
      await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: testCust1Id } }).catch(() => {});
      await prisma.customerAssignment.deleteMany({ where: { customerId: testCust1Id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: testCust1Id } }).catch(() => {});
    }
    if (testCust2Id) {
      await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: testCust2Id } }).catch(() => {});
      await prisma.customerAssignment.deleteMany({ where: { customerId: testCust2Id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: testCust2Id } }).catch(() => {});
    }
    if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    if (partnerUserA) await prisma.user.delete({ where: { id: partnerUserA.id } }).catch(() => {});
    if (partnerUserB) await prisma.user.delete({ where: { id: partnerUserB.id } }).catch(() => {});

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }

  console.log('========================================================================');
  console.log('=== ALL 4 SUITES PASSED WITH 100% SUCCESS ===');
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

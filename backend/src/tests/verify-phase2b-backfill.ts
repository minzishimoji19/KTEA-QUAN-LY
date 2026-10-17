import { PrismaClient, Role, UserStatus, FollowUpStatus, AssignmentSourceType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import assert from 'node:assert';
import http from 'node:http';
import createApp from '../app.js';
import { caretakerService } from '../services/caretaker.service.js';
import { userService } from '../services/user.service.js';
import { followUpService } from '../services/followUp.service.js';

const prisma = new PrismaClient();

async function runPhase2BVerification() {
  console.log('========================================================================');
  console.log('=== KTEA CRM PHASE 2B: BACKFILL & ASSIGNMENT SYNC VERIFICATION ===');
  console.log('========================================================================\n');

  // Baseline verification
  const initialCustomerCount = await prisma.customer.count();
  const initialFollowUpCount = await prisma.followUp.count();
  const initialCaretakerCount = await prisma.caretaker.count();
  const initialUserCount = await prisma.user.count();
  console.log(`[Baseline] Customers: ${initialCustomerCount}, FollowUps: ${initialFollowUpCount}, Caretakers: ${initialCaretakerCount}, Users: ${initialUserCount}`);

  assert.ok(initialCustomerCount >= 501, 'Baseline customers must be >= 501');
  assert.ok(initialFollowUpCount >= 140, 'Baseline followups must be >= 140');
  assert.strictEqual(initialCaretakerCount, 6, 'Baseline caretakers must be 6');

  // Start test server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  async function api(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      cookie?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ status: number; body: any; cookie: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, baseUrl);
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-ktea-request': '1',
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
            let parsedBody: any = null;
            try {
              parsedBody = JSON.parse(rawData);
            } catch (_) {
              parsedBody = rawData;
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

            resolve({
              status: res.statusCode || 500,
              body: parsedBody,
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
  }

  const timestamp = Date.now();
  const password = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  let adminUser: any = null;
  let partnerAUser: any = null;
  let partnerBUser: any = null;
  let caretakerA: any = null;
  let caretakerB: any = null;
  let unlinkedCaretaker: any = null;

  // Multiple test customers
  const testCustomers: any[] = [];
  const testFollowUps: any[] = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP: Tạo các tài khoản và caregiver thử nghiệm
    // -------------------------------------------------------------------------
    console.log('--- SETUP: Tạo tài khoản & người chăm sóc thử nghiệm ---');
    adminUser = await prisma.user.create({
      data: {
        email: `admin_p2b_${timestamp}@example.com`,
        fullName: `Admin P2B ${timestamp}`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    partnerAUser = await prisma.user.create({
      data: {
        email: `partner_a_p2b_${timestamp}@example.com`,
        fullName: `Partner A P2B ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    partnerBUser = await prisma.user.create({
      data: {
        email: `partner_b_p2b_${timestamp}@example.com`,
        fullName: `Partner B P2B ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    caretakerA = await prisma.caretaker.create({
      data: {
        name: `Caregiver A P2B ${timestamp}`,
        active: true,
      },
    });

    caretakerB = await prisma.caretaker.create({
      data: {
        name: `Caregiver B P2B ${timestamp}`,
        active: true,
      },
    });

    unlinkedCaretaker = await prisma.caretaker.create({
      data: {
        name: `Caregiver Unlinked P2B ${timestamp}`,
        active: true,
      },
    });

    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: adminUser.email, password },
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminCookie = adminLoginRes.cookie;

    // Tạo 5 khách hàng lịch sử cho Caregiver A
    console.log('Tạo 5 khách hàng lịch sử cho Caregiver A...');
    for (let i = 1; i <= 5; i++) {
      const c = await prisma.customer.create({
        data: {
          fullName: `_TEST_P2B_CUST_A_${i}_${timestamp}`,
          phone: `0911${String(timestamp).slice(-5)}${i}`,
          address: 'Hanoi',
        },
      });
      testCustomers.push(c);

      const fu = await prisma.followUp.create({
        data: {
          customerId: c.id,
          title: `Historical schedule A${i} for ${c.fullName}`,
          dueAt: new Date(Date.now() + 86400000 * i),
          assignedTo: caretakerA.name,
          status: FollowUpStatus.PENDING,
        },
      });
      testFollowUps.push(fu);
    }

    // Tạo 1 khách hàng phục vụ chung cả Caregiver A và Caregiver B (multi-caregiver customer)
    console.log('Tạo 1 khách hàng phục vụ chung cả Caregiver A và Caregiver B...');
    const sharedCustomer = await prisma.customer.create({
      data: {
        fullName: `_TEST_P2B_SHARED_CUST_${timestamp}`,
        phone: `0922${String(timestamp).slice(-6)}`,
        address: 'Danang',
      },
    });
    testCustomers.push(sharedCustomer);

    const fuSharedA = await prisma.followUp.create({
      data: {
        customerId: sharedCustomer.id,
        title: `Historical schedule for Shared Customer via Caregiver A`,
        dueAt: new Date(Date.now() + 86400000),
        assignedTo: caretakerA.name,
        status: FollowUpStatus.PENDING,
      },
    });
    testFollowUps.push(fuSharedA);

    const fuSharedB = await prisma.followUp.create({
      data: {
        customerId: sharedCustomer.id,
        title: `Historical schedule for Shared Customer via Caregiver B`,
        dueAt: new Date(Date.now() + 172800000),
        assignedTo: caretakerB.name,
        status: FollowUpStatus.PENDING,
      },
    });
    testFollowUps.push(fuSharedB);

    // Tạo 1 khách hàng chỉ gắn với Unlinked Caregiver
    const unlinkedCustomer = await prisma.customer.create({
      data: {
        fullName: `_TEST_P2B_UNLINKED_CUST_${timestamp}`,
        phone: `0933${String(timestamp).slice(-6)}`,
        address: 'Hue',
      },
    });
    testCustomers.push(unlinkedCustomer);

    const fuUnlinked = await prisma.followUp.create({
      data: {
        customerId: unlinkedCustomer.id,
        title: `Schedule for Unlinked Caregiver`,
        dueAt: new Date(Date.now() + 86400000),
        assignedTo: unlinkedCaretaker.name,
        status: FollowUpStatus.PENDING,
      },
    });
    testFollowUps.push(fuUnlinked);

    console.log('✓ Setup hoàn tất: 7 khách hàng thử nghiệm, 8 lịch chăm sóc lịch sử.\n');

    // =========================================================================
    // TEST 1: Preview Backfill Report
    // =========================================================================
    console.log('--- TEST 1: Kiểm tra Preview Backfill Report (GET /api/caretakers/backfill-preview) ---');
    const previewRes = await api('/api/caretakers/backfill-preview', { cookie: adminCookie });
    assert.strictEqual(previewRes.status, 200, 'Preview must return 200');
    const previewItemA = previewRes.body.data.find((p: any) => p.caretakerId === caretakerA.id);
    assert.ok(previewItemA, 'Caretaker A must be in preview');
    assert.strictEqual(previewItemA.totalSchedules, 6, 'Caregiver A has 6 total schedules (5 private + 1 shared)');
    assert.strictEqual(previewItemA.distinctCustomers, 6, 'Caregiver A has 6 distinct customers');
    assert.strictEqual(previewItemA.isLinked, false, 'Caregiver A is not yet linked');
    console.log('✓ TEST 1 PASSED: Báo cáo xem trước chính xác số lượng lịch (6) và khách hàng (6).');

    // =========================================================================
    // TEST 2: Chặn mapping mơ hồ, xung đột và sai vai trò
    // =========================================================================
    console.log('\n--- TEST 2: Chặn mapping mơ hồ, xung đột và sai vai trò ---');
    // Không thể link với ADMIN
    const linkAdminRes = await api(`/api/caretakers/${caretakerA.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: adminUser.id },
    });
    assert.strictEqual(linkAdminRes.status, 400, 'Must reject linking admin with 400');

    // Không thể link với account không tồn tại
    const linkNonExistent = await api(`/api/caretakers/${caretakerA.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: '00000000-0000-0000-0000-000000000000' },
    });
    assert.strictEqual(linkNonExistent.status, 404, 'Must return 404 for non-existent user');
    console.log('✓ TEST 2 PASSED: Mapping sai vai trò và tài khoản ảo bị chặn nghiêm ngặt.');

    // =========================================================================
    // TEST 3: Liên kết Caregiver A với Partner A -> TỰ ĐỘNG ĐỒNG BỘ TOÀN BỘ 6 KHÁCH HÀNG
    // =========================================================================
    console.log('\n--- TEST 3: Liên kết Caregiver A với Partner A -> Tự động đồng bộ toàn bộ 6 khách hàng ---');
    const linkARes = await api(`/api/caretakers/${caretakerA.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: partnerAUser.id },
    });
    assert.strictEqual(linkARes.status, 200);
    assert.ok(linkARes.body.data.backfill, 'Link response must contain backfill statistics');
    assert.strictEqual(linkARes.body.data.backfill.distinctCustomers, 6, 'Must sync all 6 distinct customers');
    assert.strictEqual(linkARes.body.data.backfill.totalSchedules, 6, 'Must process 6 schedules');

    // Kiểm tra trong database: 6 grants và 6 customer_assignments
    const grantsA = await prisma.customerAssignmentGrant.count({
      where: { userId: partnerAUser.id, active: true },
    });
    const assignmentsA = await prisma.customerAssignment.count({
      where: { userId: partnerAUser.id },
    });
    assert.strictEqual(grantsA, 6, 'Partner A must have 6 active grants');
    assert.strictEqual(assignmentsA, 6, 'Partner A must have 6 materialized assignments');
    console.log('✓ TEST 3 PASSED: Tự động đồng bộ 6/6 khách hàng lịch sử thành công ngay khi liên kết.');

    // =========================================================================
    // TEST 4: Partner A đăng nhập và truy cập thành công toàn bộ 6 khách hàng
    // =========================================================================
    console.log('\n--- TEST 4: Partner A đăng nhập và truy cập thành công toàn bộ 6 khách hàng ---');
    const partnerALogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerAUser.email, password },
    });
    assert.strictEqual(partnerALogin.status, 200);
    const partnerACookie = partnerALogin.cookie;

    // Partner A xem được từng khách trong số 6 khách
    for (let i = 0; i < 5; i++) {
      const getCust = await api(`/api/customers/${testCustomers[i].id}`, { cookie: partnerACookie });
      assert.strictEqual(getCust.status, 200, `Partner A must view customer A${i + 1}`);
    }
    const getShared = await api(`/api/customers/${sharedCustomer.id}`, { cookie: partnerACookie });
    assert.strictEqual(getShared.status, 200, 'Partner A must view shared customer');

    // Partner A KHÔNG THỂ xem khách của Unlinked Caregiver
    const getUnlinked = await api(`/api/customers/${unlinkedCustomer.id}`, { cookie: partnerACookie });
    assert.strictEqual(getUnlinked.status, 404, 'Partner A cannot view unlinked customer (404)');
    console.log('✓ TEST 4 PASSED: Partner A xem đủ 6 khách hàng được đồng bộ và bị chặn tuyệt đối với khách ngoài phạm vi.');

    // =========================================================================
    // TEST 5: Customer có nhiều caregiver vẫn giữ đủ quan hệ cho cả A và B
    // =========================================================================
    console.log('\n--- TEST 5: Customer có nhiều caregiver vẫn giữ đủ quan hệ cho cả A và B ---');
    // Liên kết Caregiver B với Partner B
    const linkBRes = await api(`/api/caretakers/${caretakerB.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: partnerBUser.id },
    });
    assert.strictEqual(linkBRes.status, 200);

    const partnerBLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerBUser.email, password },
    });
    assert.strictEqual(partnerBLogin.status, 200);
    const partnerBCookie = partnerBLogin.cookie;

    // Cả Partner A và Partner B ĐỀU TRUY CẬP ĐƯỢC sharedCustomer!
    const sharedCheckA = await api(`/api/customers/${sharedCustomer.id}`, { cookie: partnerACookie });
    assert.strictEqual(sharedCheckA.status, 200, 'Partner A still has access to shared customer');

    const sharedCheckB = await api(`/api/customers/${sharedCustomer.id}`, { cookie: partnerBCookie });
    assert.strictEqual(sharedCheckB.status, 200, 'Partner B now has access to shared customer');

    // Partner B KHÔNG xem được khách riêng của A
    const privateACheckB = await api(`/api/customers/${testCustomers[0].id}`, { cookie: partnerBCookie });
    assert.strictEqual(privateACheckB.status, 404, 'Partner B cannot view Customer A1');
    console.log('✓ TEST 5 PASSED: Khách hàng có 2 caregiver giữ trọn vẹn quyền truy cập độc lập cho cả A và B.');

    // =========================================================================
    // TEST 6: Chạy lại backfill (Idempotency Test) không sinh duplicate
    // =========================================================================
    console.log('\n--- TEST 6: Chạy lại backfill không sinh duplicate (Idempotency) ---');
    const backfillAgainRes = await api(`/api/caretakers/${caretakerA.id}/backfill`, {
      method: 'POST',
      cookie: adminCookie,
    });
    assert.strictEqual(backfillAgainRes.status, 200);

    const grantsCountAfterReRun = await prisma.customerAssignmentGrant.count({
      where: { userId: partnerAUser.id, active: true },
    });
    const assignmentsCountAfterReRun = await prisma.customerAssignment.count({
      where: { userId: partnerAUser.id },
    });
    assert.strictEqual(grantsCountAfterReRun, 6, 'Grants count must remain exactly 6');
    assert.strictEqual(assignmentsCountAfterReRun, 6, 'Assignments count must remain exactly 6');
    console.log('✓ TEST 6 PASSED: Chạy lại backfill không sinh bản ghi trùng lặp (100% Idempotent).');

    // =========================================================================
    // TEST 7: Thử link account đã được gán cho caregiver khác -> Chặn Conflict (409)
    // =========================================================================
    console.log('\n--- TEST 7: Thử link account đã được gán cho caregiver khác -> Chặn 409 Conflict ---');
    const conflictLink = await api(`/api/caretakers/${unlinkedCaretaker.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: partnerAUser.id },
    });
    assert.strictEqual(conflictLink.status, 409, 'Must return 409 Conflict when user is already linked to another caretaker');
    console.log('✓ TEST 7 PASSED: Xung đột liên kết tài khoản bị chặn chính xác với mã 409 Conflict.');

    // =========================================================================
    // TEST 8: Unlink Caregiver A nhưng Partner A có DIRECT assignment -> Giữ quyền DIRECT
    // =========================================================================
    console.log('\n--- TEST 8: Unlink Caregiver A nhưng Partner A có DIRECT assignment -> Giữ quyền DIRECT ---');
    // Admin gán DIRECT Customer A1 cho Partner A
    await userService.assignCustomers(
      { id: adminUser.id, email: adminUser.email },
      partnerAUser.id,
      [testCustomers[0].id]
    );

    // Unlink Caregiver A
    const unlinkRes = await api(`/api/caretakers/${caretakerA.id}/unlink`, {
      method: 'POST',
      cookie: adminCookie,
    });
    assert.strictEqual(unlinkRes.status, 200);

    // Quyền truy cập các khách khác của Caregiver A bị thu hồi (404)
    const checkCust2 = await api(`/api/customers/${testCustomers[1].id}`, { cookie: partnerACookie });
    assert.strictEqual(checkCust2.status, 404, 'Customer A2 access must be revoked (404)');

    // NHƯNG Customer A1 (có nguồn DIRECT) VẪN CÒN QUYỀN TRUY CẬP (200)!
    const checkCust1Direct = await api(`/api/customers/${testCustomers[0].id}`, { cookie: partnerACookie });
    assert.strictEqual(checkCust1Direct.status, 200, 'Customer A1 access must be preserved via DIRECT assignment (200)');
    console.log('✓ TEST 8 PASSED: Unlink Caregiver thu hồi đúng các nguồn lịch chăm sóc, bảo toàn nguồn phân công trực tiếp.');

    // =========================================================================
    // TEST 9: Unlinked Caregiver và lịch sử cũ không bị mất mát
    // =========================================================================
    console.log('\n--- TEST 9: Unlinked Caregiver và lịch sử cũ không bị mất mát ---');
    const unlinkedScheduleInDb = await prisma.followUp.findUnique({
      where: { id: fuUnlinked.id },
    });
    assert.ok(unlinkedScheduleInDb, 'Schedule for unlinked caretaker must exist intact');
    assert.strictEqual(unlinkedScheduleInDb.assignedTo, unlinkedCaretaker.name);
    console.log('✓ TEST 9 PASSED: Caregiver chưa có tài khoản vẫn lưu đầy đủ lịch sử và không bị ảnh hưởng.');

    // =========================================================================
    // TEST 10: Toàn bộ dữ liệu baseline 100% nguyên vẹn
    // =========================================================================
    console.log('\n--- TEST 10: Kiểm tra dữ liệu gốc 100% nguyên vẹn ---');
    const finalCustomerCount = await prisma.customer.count({
      where: { id: { notIn: testCustomers.map((c) => c.id) } },
    });
    const finalFollowUpCount = await prisma.followUp.count({
      where: { id: { notIn: testFollowUps.map((f) => f.id) } },
    });

    assert.strictEqual(finalCustomerCount, initialCustomerCount, 'Customer count must match baseline 501');
    assert.strictEqual(finalFollowUpCount, initialFollowUpCount, 'FollowUp count must match baseline 140');
    console.log(`✓ TEST 10 PASSED: Dữ liệu gốc 501 khách hàng và 140 lịch chăm sóc được bảo toàn 100% nguyên vẹn.\n`);

  } finally {
    console.log('--- CLEANUP: REMOVING PHASE 2B TEST FIXTURES ---');
    try {
      for (const c of testCustomers) {
        await prisma.customerActivity.deleteMany({ where: { customerId: c.id } });
        await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: c.id } });
        await prisma.customerAssignment.deleteMany({ where: { customerId: c.id } });
        await prisma.followUp.deleteMany({ where: { customerId: c.id } });
        await prisma.customer.delete({ where: { id: c.id } });
      }
      if (caretakerA) await prisma.caretaker.delete({ where: { id: caretakerA.id } });
      if (caretakerB) await prisma.caretaker.delete({ where: { id: caretakerB.id } });
      if (unlinkedCaretaker) await prisma.caretaker.delete({ where: { id: unlinkedCaretaker.id } });
      if (partnerAUser) await prisma.user.delete({ where: { id: partnerAUser.id } });
      if (partnerBUser) await prisma.user.delete({ where: { id: partnerBUser.id } });
      if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });
      console.log('✓ Cleaned up all Phase 2B fixtures.');
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
    server.close();
  }

  console.log('========================================================================');
  console.log('=== ALL PHASE 2B BACKFILL & SYNC VERIFICATION SCENARIOS PASSED! ===');
  console.log('========================================================================');
}

runPhase2BVerification()
  .catch((err) => {
    console.error('\n❌ PHASE 2B VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

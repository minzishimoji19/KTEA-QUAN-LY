import { PrismaClient, Role, UserStatus, FollowUpStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import assert from 'node:assert';
import http from 'node:http';
import createApp from '../app.js';
import { followUpService } from '../services/followUp.service.js';
import { userService } from '../services/user.service.js';

const prisma = new PrismaClient();

async function runAcceptance() {
  console.log('========================================================================');
  console.log('=== KTEA CRM PHASE 5: 10-STEP END-TO-END ACCEPTANCE VERIFICATION ===');
  console.log('========================================================================\n');

  // Baseline verification
  const initialCustomerCount = await prisma.customer.count();
  const initialFollowUpCount = await prisma.followUp.count();
  const initialCaretakerCount = await prisma.caretaker.count();
  console.log(`[Baseline] Customers: ${initialCustomerCount}, FollowUps: ${initialFollowUpCount}, Caretakers: ${initialCaretakerCount}`);
  assert.strictEqual(initialCustomerCount, 501, 'Baseline customers must be 501');
  assert.strictEqual(initialFollowUpCount, 140, 'Baseline followups must be 140');
  assert.strictEqual(initialCaretakerCount, 6, 'Baseline caretakers must be 6');

  // Start test server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Server] Running at ${baseUrl}\n`);

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
  let testCustomer1: any = null;
  let testCustomer2: any = null;
  let followUpSchedule1: any = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Đăng nhập ADMIN
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: Đăng nhập ADMIN ---');
    adminUser = await prisma.user.create({
      data: {
        email: `admin_p5_${timestamp}@example.com`,
        fullName: `Admin P5 ${timestamp}`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: adminUser.email, password },
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login must return 200');
    const adminCookie = adminLoginRes.cookie;
    assert.ok(adminCookie, 'Admin session cookie must be set');
    console.log('✓ STEP 1 PASSED: Admin đăng nhập thành công và nhận session cookie.');

    // -------------------------------------------------------------------------
    // STEP 2: Kiểm tra caregiver cũ
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: Kiểm tra caregiver cũ ---');
    const getCaretakersRes = await api('/api/caretakers', { cookie: adminCookie });
    assert.strictEqual(getCaretakersRes.status, 200);
    const existingCaretakers = getCaretakersRes.body.data;
    assert.ok(Array.isArray(existingCaretakers));
    assert.ok(existingCaretakers.length >= 6, 'Must list at least 6 historical caretakers');
    const names = existingCaretakers.map((c: any) => c.name);
    assert.ok(names.includes('Ktea'), 'Must include historical caretaker Ktea');
    assert.ok(names.includes('xoaicaldez'), 'Must include historical caretaker xoaicaldez');
    assert.ok(names.includes('Lê Na'), 'Must include historical caretaker Lê Na');
    console.log(`✓ STEP 2 PASSED: 6 caregiver lịch sử còn nguyên vẹn trong danh sách (${names.slice(0, 6).join(', ')}).`);

    // -------------------------------------------------------------------------
    // STEP 3: Liên kết caregiver với account PARTNER
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Liên kết caregiver với account PARTNER ---');
    partnerAUser = await prisma.user.create({
      data: {
        email: `partner_a_p5_${timestamp}@example.com`,
        fullName: `Partner A P5 ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    partnerBUser = await prisma.user.create({
      data: {
        email: `partner_b_p5_${timestamp}@example.com`,
        fullName: `Partner B P5 ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    caretakerA = await prisma.caretaker.create({
      data: {
        name: `Caregiver A P5 ${timestamp}`,
        active: true,
      },
    });

    caretakerB = await prisma.caretaker.create({
      data: {
        name: `Caregiver B P5 ${timestamp}`,
        active: true,
      },
    });

    const linkRes = await api(`/api/caretakers/${caretakerA.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: partnerAUser.id },
    });
    assert.strictEqual(linkRes.status, 200, 'Link caretaker must return 200');
    assert.strictEqual(linkRes.body.data.userId, partnerAUser.id);
    console.log(`✓ STEP 3 PASSED: Đã liên kết Caregiver "${caretakerA.name}" với Partner A (${partnerAUser.email}).`);

    // Link caretakerB with partnerB
    await api(`/api/caretakers/${caretakerB.id}/link`, {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: { userId: partnerBUser.id },
    });

    // -------------------------------------------------------------------------
    // STEP 4: Tạo lịch chăm sóc
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: Tạo lịch chăm sóc ---');
    testCustomer1 = await prisma.customer.create({
      data: {
        fullName: `_TEST_P5_CUST_1_${timestamp}`,
        phone: `0987${String(timestamp).slice(-6)}`,
        address: 'Hanoi',
      },
    });

    testCustomer2 = await prisma.customer.create({
      data: {
        fullName: `_TEST_P5_CUST_2_${timestamp}`,
        phone: `0988${String(timestamp).slice(-6)}`,
        address: 'HCM',
      },
    });

    const createScheduleRes = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        customerId: testCustomer1.id,
        title: `Schedule for Caregiver A P5 ${timestamp}`,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        assignedTo: caretakerA.name,
      },
    });
    assert.strictEqual(createScheduleRes.status, 201, 'Create follow-up must return 201');
    followUpSchedule1 = createScheduleRes.body.data;
    console.log('✓ STEP 4 PASSED: ADMIN tạo lịch chăm sóc thành công.');

    // -------------------------------------------------------------------------
    // STEP 5: Xác minh assignment đúng
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Xác minh assignment đúng ---');
    const grantA = await prisma.customerAssignmentGrant.findFirst({
      where: {
        customerId: testCustomer1.id,
        userId: partnerAUser.id,
        sourceType: 'CARE_SCHEDULE',
        sourceId: followUpSchedule1.id,
        active: true,
      },
    });
    assert.ok(grantA, 'Grant must exist for Partner A');

    const assignmentA = await prisma.customerAssignment.findFirst({
      where: {
        customerId: testCustomer1.id,
        userId: partnerAUser.id,
      },
    });
    assert.ok(assignmentA, 'Materialized CustomerAssignment must exist for Partner A');
    console.log('✓ STEP 5 PASSED: Nguồn grant và materialized assignment được đồng bộ chính xác.');

    // -------------------------------------------------------------------------
    // STEP 6: Đăng nhập PARTNER và xác minh khách được phân công hiển thị
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Đăng nhập PARTNER và xác minh khách hiển thị ---');
    const partnerALoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerAUser.email, password },
    });
    assert.strictEqual(partnerALoginRes.status, 200);
    const partnerACookie = partnerALoginRes.cookie;

    const getAssignedCustomerRes = await api(`/api/customers/${testCustomer1.id}`, { cookie: partnerACookie });
    assert.strictEqual(getAssignedCustomerRes.status, 200, 'Partner A must view assigned customer');
    assert.strictEqual(getAssignedCustomerRes.body.data.id, testCustomer1.id);
    console.log('✓ STEP 6 PASSED: Partner A đăng nhập và xem được chi tiết khách hàng được phân công.');

    // -------------------------------------------------------------------------
    // STEP 7: Xác minh PARTNER không xem được khách ngoài phạm vi
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: Xác minh PARTNER không xem được khách ngoài phạm vi ---');
    const getUnassignedCustomerRes = await api(`/api/customers/${testCustomer2.id}`, { cookie: partnerACookie });
    assert.strictEqual(getUnassignedCustomerRes.status, 404, 'Out of scope customer must return 404');

    const searchRes = await api(`/api/customers?search=${testCustomer2.phone}`, { cookie: partnerACookie });
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.data.length, 0, 'Out of scope customer must not appear in search');
    console.log('✓ STEP 7 PASSED: Khách ngoài phạm vi trả 404 và không rò rỉ qua công cụ tìm kiếm.');

    // -------------------------------------------------------------------------
    // STEP 8: Đổi caregiver và kiểm tra quyền của A/B
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: Đổi caregiver và kiểm tra quyền của A/B ---');
    const updateScheduleRes = await api(`/api/follow-ups/${followUpSchedule1.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        assignedTo: caretakerB.name,
      },
    });
    assert.strictEqual(updateScheduleRes.status, 200);

    // Partner A now has 0 grants -> 404
    const partnerACheckAfterChange = await api(`/api/customers/${testCustomer1.id}`, { cookie: partnerACookie });
    assert.strictEqual(partnerACheckAfterChange.status, 404, 'Partner A should lose access (404)');

    // Partner B login -> 200
    const partnerBLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerBUser.email, password },
    });
    assert.strictEqual(partnerBLoginRes.status, 200);
    const partnerBCookie = partnerBLoginRes.cookie;

    const partnerBCheckAfterChange = await api(`/api/customers/${testCustomer1.id}`, { cookie: partnerBCookie });
    assert.strictEqual(partnerBCheckAfterChange.status, 200, 'Partner B should gain access (200)');
    console.log('✓ STEP 8 PASSED: Đổi caregiver chuyển giao quyền an toàn (A: 404, B: 200).');

    // -------------------------------------------------------------------------
    // STEP 9: Hủy lịch và xác minh assignment độc lập vẫn còn
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 9: Hủy lịch và xác minh assignment độc lập vẫn còn ---');
    // Admin directly assigns Customer 1 to Partner B
    await userService.assignCustomers(
      { id: adminUser.id, email: adminUser.email },
      partnerBUser.id,
      [testCustomer1.id]
    );

    // Verify Partner B now has 2 grants: DIRECT + CARE_SCHEDULE
    const bGrants = await prisma.customerAssignmentGrant.count({
      where: { customerId: testCustomer1.id, userId: partnerBUser.id, active: true },
    });
    assert.strictEqual(bGrants, 2, 'Partner B should have 2 active grants');

    // Cancel the care schedule (status CANCELLED)
    await followUpService.updateFollowUp(followUpSchedule1.id, { status: FollowUpStatus.CANCELLED });

    // Verify Partner B STILL HAS ACCESS via DIRECT assignment
    const partnerBCheckAfterCancel = await api(`/api/customers/${testCustomer1.id}`, { cookie: partnerBCookie });
    assert.strictEqual(partnerBCheckAfterCancel.status, 200, 'Partner B must retain access via independent DIRECT grant');
    console.log('✓ STEP 9 PASSED: Hủy lịch không thu hồi quyền của Partner B vì còn assignment độc lập.');

    // -------------------------------------------------------------------------
    // STEP 10: Kiểm tra log backend & Bảo toàn dữ liệu
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 10: Kiểm tra log backend & Bảo toàn dữ liệu ---');
    const auditLogsCount = await prisma.auditLog.count({
      where: { entityType: { in: ['ASSIGNMENT', 'CARE_SCHEDULE', 'CARETAKER'] } },
    });
    console.log(`✓ Audit log entries recorded: ${auditLogsCount}`);

  } finally {
    console.log('\n--- CLEANING UP TEST FIXTURES ---');
    try {
      if (testCustomer1) {
        await prisma.customerActivity.deleteMany({ where: { customerId: testCustomer1.id } });
        await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: testCustomer1.id } });
        await prisma.customerAssignment.deleteMany({ where: { customerId: testCustomer1.id } });
        await prisma.followUp.deleteMany({ where: { customerId: testCustomer1.id } });
        await prisma.customer.delete({ where: { id: testCustomer1.id } });
      }
      if (testCustomer2) {
        await prisma.customerActivity.deleteMany({ where: { customerId: testCustomer2.id } });
        await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: testCustomer2.id } });
        await prisma.customerAssignment.deleteMany({ where: { customerId: testCustomer2.id } });
        await prisma.followUp.deleteMany({ where: { customerId: testCustomer2.id } });
        await prisma.customer.delete({ where: { id: testCustomer2.id } });
      }
      if (caretakerA) await prisma.caretaker.delete({ where: { id: caretakerA.id } });
      if (caretakerB) await prisma.caretaker.delete({ where: { id: caretakerB.id } });
      if (partnerAUser) await prisma.user.delete({ where: { id: partnerAUser.id } });
      if (partnerBUser) await prisma.user.delete({ where: { id: partnerBUser.id } });
      if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });
      console.log('✓ Cleaned up all acceptance fixtures.');
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
    server.close();
  }

  // Final baseline check
  const finalCustomerCount = await prisma.customer.count();
  const finalFollowUpCount = await prisma.followUp.count();
  const finalCaretakerCount = await prisma.caretaker.count();
  assert.strictEqual(finalCustomerCount, initialCustomerCount, 'Customer count must match baseline');
  assert.strictEqual(finalFollowUpCount, initialFollowUpCount, 'FollowUp count must match baseline');
  assert.strictEqual(finalCaretakerCount, initialCaretakerCount, 'Caretaker count must match baseline');
  console.log(`\n[Final Integrity Check] Customers: ${finalCustomerCount}, FollowUps: ${finalFollowUpCount}, Caretakers: ${finalCaretakerCount}`);
  console.log('========================================================================');
  console.log('=== ALL 10 ACCEPTANCE VERIFICATION STEPS COMPLETED WITH 100% SUCCESS ===');
  console.log('========================================================================\n');
}

runAcceptance()
  .catch((err) => {
    console.error('Acceptance failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

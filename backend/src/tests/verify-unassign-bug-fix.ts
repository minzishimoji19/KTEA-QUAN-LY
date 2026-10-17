import { PrismaClient, Role, UserStatus, AssignmentSourceType, FollowUpStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import assert from 'node:assert';
import http from 'node:http';
import createApp from '../app.js';
import { userService } from '../services/user.service.js';

const prisma = new PrismaClient();

async function runUnassignTests() {
  console.log('========================================================================');
  console.log('=== KTEA CRM: VERIFICATION OF CUSTOMER UNASSIGNMENT BUG FIX ===');
  console.log('========================================================================\n');

  // Start test server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`- Ephemeral HTTP test server running at ${baseUrl}`);

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
            resolve({
              status: res.statusCode || 500,
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
  }

  const timestamp = Date.now();
  const testPassword = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  let adminUser: any = null;
  let partnerUser: any = null;
  let testCustomerA: any = null;
  let testCustomerB: any = null;
  let testFollowUpA: any = null;
  let testFollowUpB: any = null;

  try {
    // Setup test users
    adminUser = await prisma.user.create({
      data: {
        email: `unassign_admin_${timestamp}@example.com`,
        fullName: `Unassign Admin ${timestamp}`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    partnerUser = await prisma.user.create({
      data: {
        email: `unassign_partner_${timestamp}@example.com`,
        fullName: `Unassign Partner ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    // Pick 2 real customers
    const realCustomers = await prisma.customer.findMany({ take: 2 });
    assert.strictEqual(realCustomers.length, 2, 'Need 2 customers for testing');
    testCustomerA = realCustomers[0];
    testCustomerB = realCustomers[1];

    // Admin login
    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: adminUser.email, password: testPassword },
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login failed');
    const adminCookie = adminLoginRes.cookie;

    // Partner login
    const partnerLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerUser.email, password: testPassword },
    });
    assert.strictEqual(partnerLoginRes.status, 200, 'Partner login failed');
    let partnerCookie = partnerLoginRes.cookie;

    // -------------------------------------------------------------------------
    // TEST A: HỦY PHÂN CÔNG ĐƠN LẺ (DIRECT ASSIGNMENT)
    // -------------------------------------------------------------------------
    console.log('[TEST A] Admin trực tiếp phân công và hủy phân công...');
    // 1. Admin assigns Customer A directly
    const assignRes = await api('/api/users/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        userId: partnerUser.id,
        customerIds: [testCustomerA.id],
        notes: 'Test Direct Assignment',
      },
    });
    assert.strictEqual(assignRes.status, 200, 'Assign must return 200');

    // Verify assignment exists in DB
    const dbAssign1 = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: testCustomerA.id, userId: partnerUser.id } },
    });
    assert.ok(dbAssign1, 'Assignment must exist in database');

    // Verify GET /api/users/:id/assignments returns it with sources
    const listRes1 = await api(`/api/users/${partnerUser.id}/assignments`, { cookie: adminCookie });
    assert.strictEqual(listRes1.status, 200);
    const itemA = listRes1.body.data.find((x: any) => x.customerId === testCustomerA.id);
    assert.ok(itemA, 'Customer A must appear in partner assignments');
    assert.strictEqual(itemA.sources.hasDirect, true, 'sources.hasDirect must be true');

    // 2. Admin unassigns Customer A
    const unassignResA = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        partnerUserId: partnerUser.id,
        customerId: testCustomerA.id,
        sourceType: 'DIRECT',
      },
    });
    assert.strictEqual(unassignResA.status, 200, 'Unassign must return 200');
    assert.strictEqual(unassignResA.body.data.completelyRevoked, true, 'Must be completely revoked');

    // 3. Verify database no longer has assignment or grant
    const dbAssignAfterA = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: testCustomerA.id, userId: partnerUser.id } },
    });
    assert.strictEqual(dbAssignAfterA, null, 'CustomerAssignment must be deleted from DB');

    const dbGrantAfterA = await prisma.customerAssignmentGrant.findFirst({
      where: { customerId: testCustomerA.id, userId: partnerUser.id },
    });
    assert.strictEqual(dbGrantAfterA, null, 'CustomerAssignmentGrant must be deleted from DB');

    // 4. Reload assignments API: Customer A MUST NOT BE PRESENT!
    const listResAfterA = await api(`/api/users/${partnerUser.id}/assignments`, { cookie: adminCookie });
    const foundAfterA = listResAfterA.body.data.find((x: any) => x.customerId === testCustomerA.id);
    assert.strictEqual(foundAfterA, undefined, 'Customer A must NOT appear after reload');
    console.log('✓ TEST A PASSED: Direct unassignment removes record completely from DB and API.');

    // -------------------------------------------------------------------------
    // TEST B: ĐĂNG NHẬP LẠI (SESSION RELOAD VERIFICATION)
    // -------------------------------------------------------------------------
    console.log('\n[TEST B] Partner đăng xuất và đăng nhập lại...');
    // Partner re-logs in to simulate fresh session
    const partnerReloginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partnerUser.email, password: testPassword },
    });
    assert.strictEqual(partnerReloginRes.status, 200);
    partnerCookie = partnerReloginRes.cookie;

    // Check Partner's own customer list
    const partnerCustList = await api('/api/customers', { cookie: partnerCookie });
    assert.strictEqual(partnerCustList.status, 200);
    const partnerHasCustomerA = partnerCustList.body.data.some((c: any) => c.id === testCustomerA.id);
    assert.strictEqual(partnerHasCustomerA, false, 'Partner must not see unassigned Customer A');

    // Check Partner querying Customer A detail directly -> 404
    const detail404 = await api(`/api/customers/${testCustomerA.id}`, { cookie: partnerCookie });
    assert.strictEqual(detail404.status, 404, 'Direct access to unassigned customer must return 404');
    console.log('✓ TEST B PASSED: Fresh session confirms customer stays unassigned permanently.');

    // -------------------------------------------------------------------------
    // TEST C: NHIỀU NGUỒN PHÂN CÔNG (DIRECT + CARE_SCHEDULE)
    // -------------------------------------------------------------------------
    console.log('\n[TEST C] Phân công qua 2 nguồn, hủy 1 nguồn -> nguồn còn lại bảo toàn...');
    // 1. Assign Customer B via DIRECT
    await api('/api/users/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { userId: partnerUser.id, customerIds: [testCustomerB.id] },
    });

    // 2. Create FollowUp on Customer B assigned to partner -> CARE_SCHEDULE grant
    const createFuRes = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerId: testCustomerB.id,
        title: 'UNASSIGN_MULTI_SOURCE_TEST',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        assignedToUserId: partnerUser.id,
      },
    });
    assert.strictEqual(createFuRes.status, 201);
    testFollowUpB = createFuRes.body.data;

    // Verify GET /api/users/:id/assignments shows BOTH sources
    const listMulti = await api(`/api/users/${partnerUser.id}/assignments`, { cookie: adminCookie });
    const itemMulti = listMulti.body.data.find((x: any) => x.customerId === testCustomerB.id);
    assert.ok(itemMulti, 'Customer B must be assigned');
    assert.strictEqual(itemMulti.sources.hasDirect, true, 'Must have direct grant');
    assert.strictEqual(itemMulti.sources.hasCareSchedule, true, 'Must have care schedule grant');
    assert.strictEqual(itemMulti.sources.careSchedulesCount, 1, 'Care schedules count must be 1');

    // 3. Admin revokes ONLY DIRECT
    const revokeDirectRes = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        partnerUserId: partnerUser.id,
        customerId: testCustomerB.id,
        sourceType: 'DIRECT',
      },
    });
    assert.strictEqual(revokeDirectRes.status, 200);
    assert.strictEqual(revokeDirectRes.body.data.completelyRevoked, false, 'Must NOT be completely revoked');
    assert.strictEqual(revokeDirectRes.body.data.remainingSourcesCount, 1, '1 source must remain');

    // Customer B must STILL be accessible to Partner via CARE_SCHEDULE
    const partnerCanAccessB = await api(`/api/customers/${testCustomerB.id}`, { cookie: partnerCookie });
    assert.strictEqual(partnerCanAccessB.status, 200, 'Partner retains access via care schedule');

    // Reload assignments: hasDirect is now false, hasCareSchedule is true
    const listAfterDirectRevoke = await api(`/api/users/${partnerUser.id}/assignments`, { cookie: adminCookie });
    const itemAfterDirectRevoke = listAfterDirectRevoke.body.data.find((x: any) => x.customerId === testCustomerB.id);
    assert.ok(itemAfterDirectRevoke, 'Customer B still present in assignment list');
    assert.strictEqual(itemAfterDirectRevoke.sources.hasDirect, false, 'Direct source now removed');
    assert.strictEqual(itemAfterDirectRevoke.sources.hasCareSchedule, true, 'Care schedule source preserved');
    console.log('✓ TEST C PASSED: Multi-source revocation preserves remaining source and access.');

    // -------------------------------------------------------------------------
    // TEST D: HỦY NGUỒN CUỐI CÙNG -> HOÀN TOÀN THU HỒI
    // -------------------------------------------------------------------------
    console.log('\n[TEST D] Hủy nguồn cuối cùng (CARE_SCHEDULE)...');
    const revokeLastRes = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        partnerUserId: partnerUser.id,
        customerId: testCustomerB.id,
        sourceType: 'CARE_SCHEDULE',
      },
    });
    assert.strictEqual(revokeLastRes.status, 200);
    assert.strictEqual(revokeLastRes.body.data.completelyRevoked, true, 'Must be completely revoked now');
    assert.strictEqual(revokeLastRes.body.data.remainingSourcesCount, 0, '0 sources remain');

    // Verify follow-up record WAS NOT DELETED! Only unassigned!
    const followUpRecord = await prisma.followUp.findUnique({ where: { id: testFollowUpB.id } });
    assert.ok(followUpRecord, 'Follow-up MUST NOT be deleted (Rule 7: Data Preservation)');
    assert.strictEqual(followUpRecord.assignedToUserId, null, 'Follow-up assignedToUserId must be set to null');
    assert.strictEqual(followUpRecord.assignedTo, null, 'Follow-up assignedTo text must be set to null');

    // CustomerAssignment must be deleted
    const dbAssignB = await prisma.customerAssignment.findUnique({
      where: { customerId_userId: { customerId: testCustomerB.id, userId: partnerUser.id } },
    });
    assert.strictEqual(dbAssignB, null, 'CustomerAssignment must be deleted');

    // Partner access to Customer B must now be 404
    const partnerAccessLostB = await api(`/api/customers/${testCustomerB.id}`, { cookie: partnerCookie });
    assert.strictEqual(partnerAccessLostB.status, 404, 'Partner must get 404 for revoked Customer B');
    console.log('✓ TEST D PASSED: Final source revocation removes all access; follow-up history preserved.');

    // -------------------------------------------------------------------------
    // TEST E: BẢO VỆ RBAC (PARTNER KHÔNG THỂ HỦY PHÂN CÔNG)
    // -------------------------------------------------------------------------
    console.log('\n[TEST E] Kiểm tra bảo vệ quyền ADMIN trên endpoint unassign...');
    const partnerUnassignForbidden = await api('/api/users/unassign', {
      method: 'POST',
      cookie: partnerCookie,
      body: { partnerUserId: partnerUser.id, customerId: testCustomerA.id },
    });
    assert.strictEqual(partnerUnassignForbidden.status, 403, 'Partner must get 403 Forbidden');
    console.log('✓ TEST E PASSED: Non-admin unassignment strictly rejected.');

    // -------------------------------------------------------------------------
    // TEST F: REQUEST LẶP LẠI (IDEMPOTENCY)
    // -------------------------------------------------------------------------
    console.log('\n[TEST F] Gửi yêu cầu hủy lặp lại nhiều lần...');
    const duplicateUnassign1 = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: { partnerUserId: partnerUser.id, customerId: testCustomerA.id, sourceType: 'ALL' },
    });
    assert.strictEqual(duplicateUnassign1.status, 200, 'Duplicate request 1 must return 200 safely');

    const duplicateUnassign2 = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: { partnerUserId: partnerUser.id, customerId: testCustomerA.id, sourceType: 'ALL' },
    });
    assert.strictEqual(duplicateUnassign2.status, 200, 'Duplicate request 2 must return 200 safely');
    assert.strictEqual(duplicateUnassign2.body.data.completelyRevoked, true);
    console.log('✓ TEST F PASSED: Idempotent repeat requests execute safely without error.');

    // -------------------------------------------------------------------------
    // TEST G: REPRODUCE & VERIFY ORIGINAL BUG (UNASSIGNING CARE_SCHEDULE ONLY CUSTOMER)
    // -------------------------------------------------------------------------
    console.log('\n[TEST G] Tái hiện và kiểm chứng trường hợp khách chỉ có lịch chăm sóc (như dữ liệu prod)...');
    // Create follow-up assigning Customer A to partner WITHOUT creating any DIRECT assignment
    const fuBugRepro = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerId: testCustomerA.id,
        title: 'BUG_REPRO_FOLLOWUP',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        assignedToUserId: partnerUser.id,
      },
    });
    assert.strictEqual(fuBugRepro.status, 201);
    testFollowUpA = fuBugRepro.body.data;

    // Verify it only has CARE_SCHEDULE
    const listBug = await api(`/api/users/${partnerUser.id}/assignments`, { cookie: adminCookie });
    const itemBug = listBug.body.data.find((x: any) => x.customerId === testCustomerA.id);
    assert.ok(itemBug, 'Customer A must be assigned');
    assert.strictEqual(itemBug.sources.hasDirect, false, 'hasDirect must be false');
    assert.strictEqual(itemBug.sources.hasCareSchedule, true, 'hasCareSchedule must be true');

    // Admin calls unassign (even without specifying sourceType, our smart-detector detects CARE_SCHEDULE!)
    const unassignBugRes = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        partnerUserId: partnerUser.id,
        customerId: testCustomerA.id,
      },
    });
    assert.strictEqual(unassignBugRes.status, 200);
    assert.strictEqual(unassignBugRes.body.data.completelyRevoked, true, 'Must be completely revoked');

    // RELOAD: Must NOT be present anymore!
    const listBugAfter = await api(`/api/users/${partnerUser.id}/assignments`, { cookie: adminCookie });
    const itemBugAfter = listBugAfter.body.data.find((x: any) => x.customerId === testCustomerA.id);
    assert.strictEqual(itemBugAfter, undefined, 'CRITICAL: Customer A MUST NOT remain in assignment list after reload!');
    console.log('✓ TEST G PASSED: Original bug permanently resolved — care-schedule-only customer properly unassigned and removed on reload.');

    console.log('\n========================================================================');
    console.log('=== ALL 7 COMPREHENSIVE TESTS (A-G) PASSED WITH 100% SUCCESS ===');
    console.log('========================================================================\n');
  } finally {
    // Cleanup test records
    if (testFollowUpA) {
      await prisma.followUp.delete({ where: { id: testFollowUpA.id } }).catch(() => {});
    }
    if (testFollowUpB) {
      await prisma.followUp.delete({ where: { id: testFollowUpB.id } }).catch(() => {});
    }
    if (partnerUser) {
      await prisma.customerAssignmentGrant.deleteMany({ where: { userId: partnerUser.id } }).catch(() => {});
      await prisma.customerAssignment.deleteMany({ where: { userId: partnerUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: partnerUser.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runUnassignTests().catch((err) => {
  console.error('\n[UNASSIGN VERIFICATION FAILED]:', err);
  process.exit(1);
});

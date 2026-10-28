import { PrismaClient, Role, UserStatus, CustomerStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import assert from 'node:assert';
import http from 'node:http';
import createApp from '../app.js';

const prisma = new PrismaClient();

async function runHistoricalVisibilityTests() {
  console.log('==============================================================================');
  console.log('=== KTEA CRM: PARTNER HISTORICAL ASSIGNMENT VISIBILITY & RBAC VERIFICATION ===');
  console.log('==============================================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`- Ephemeral HTTP test server running at ${baseUrl}\n`);

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

  const ts = Date.now();
  const testPassword = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  let adminUser: any = null;
  let partner1: any = null;
  let partner2: any = null;
  let customerA: any = null;
  let customerB: any = null;
  let customerUnassigned: any = null;
  const createdFollowUpIds: string[] = [];

  try {
    // Setup 1 Admin and 2 Partners
    adminUser = await prisma.user.create({
      data: {
        email: `hist_admin_${ts}@example.com`,
        fullName: `Hist Admin ${ts}`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    partner1 = await prisma.user.create({
      data: {
        email: `hist_partner1_${ts}@example.com`,
        fullName: `Hist Partner One ${ts}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    partner2 = await prisma.user.create({
      data: {
        email: `hist_partner2_${ts}@example.com`,
        fullName: `Hist Partner Two ${ts}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    // Create 3 isolated test customers (and clean them up in finally)
    customerA = await prisma.customer.create({
      data: {
        fullName: `Hist Customer Alpha ${ts}`,
        phone: `0991${String(ts).slice(-6)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });

    customerB = await prisma.customer.create({
      data: {
        fullName: `Hist Customer Beta ${ts}`,
        phone: `0992${String(ts).slice(-6)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });

    customerUnassigned = await prisma.customer.create({
      data: {
        fullName: `Hist Customer Unassigned ${ts}`,
        phone: `0993${String(ts).slice(-6)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });

    // Login all 3 users
    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: adminUser.email, password: testPassword },
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed');
    const adminCookie = adminLogin.cookie;

    const p1Login = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partner1.email, password: testPassword },
    });
    assert.strictEqual(p1Login.status, 200, 'Partner 1 login must succeed');
    const p1Cookie = p1Login.cookie;

    const p2Login = await api('/api/auth/login', {
      method: 'POST',
      body: { email: partner2.email, password: testPassword },
    });
    assert.strictEqual(p2Login.status, 200, 'Partner 2 login must succeed');
    const p2Cookie = p2Login.cookie;

    // =========================================================================
    // TEST 1: Partner thấy customer đang được phân công
    // =========================================================================
    console.log('[TEST 1] Partner 1 thấy customer đang được phân công...');
    const assignCustomerARes = await api('/api/users/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        userId: partner1.id,
        customerIds: [customerA.id, customerB.id],
      },
    });
    assert.strictEqual(assignCustomerARes.status, 200);

    const p1CustomersRes1 = await api('/api/customers', { cookie: p1Cookie });
    assert.strictEqual(p1CustomersRes1.status, 200);
    const foundAInP1 = p1CustomersRes1.body.data.find((c: any) => c.id === customerA.id);
    assert.ok(foundAInP1, 'Partner 1 must see currently assigned Customer A');
    assert.strictEqual(foundAInP1.isCurrentlyAssignedToMe, true);
    assert.strictEqual(foundAInP1.isHistoricalForMe, false);
    assert.strictEqual(foundAInP1.assignmentStatus, 'CURRENT');
    assert.strictEqual(foundAInP1.canEditCustomer, true);
    console.log('✓ TEST 1 PASSED: Partner sees currently assigned customer with CURRENT status.\n');

    // Create 2 schedules on Customer A for Partner 1:
    // - Schedule 1: Partner 1 completes it
    // - Schedule 2: Pending schedule initially assigned to Partner 1, then transferred to Partner 2
    const createFu1Res = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerId: customerA.id,
        title: `P1 Completed Schedule ${ts}`,
        description: 'Care result by Partner 1',
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
        assignedToUserId: partner1.id,
      },
    });
    assert.strictEqual(createFu1Res.status, 201);
    const fu1 = createFu1Res.body.data;
    createdFollowUpIds.push(fu1.id);

    // Partner 1 completes Schedule 1 while currently assigned
    const completeFu1Res = await api(`/api/follow-ups/${fu1.id}`, {
      method: 'PATCH',
      cookie: p1Cookie,
      body: { status: 'COMPLETED' },
    });
    assert.strictEqual(completeFu1Res.status, 200, 'Partner 1 can complete their own active schedule');

    const createFu2Res = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerId: customerA.id,
        title: `Transferred Schedule P1->P2 ${ts}`,
        description: 'Initially assigned to P1, then transferred to P2',
        dueAt: new Date(Date.now() + 7200_000).toISOString(),
        assignedToUserId: partner1.id,
      },
    });
    assert.strictEqual(createFu2Res.status, 201);
    const fu2 = createFu2Res.body.data;
    createdFollowUpIds.push(fu2.id);

    // =========================================================================
    // TEST 2: Partner vẫn thấy customer từng được phân công sau khi chuyển assignment
    // =========================================================================
    console.log('[TEST 2] Admin chuyển Customer A từ Partner 1 sang Partner 2...');
    // Admin transfers Schedule 2 to Partner 2 and revokes Partner 1's direct assignment on Customer A
    const transferFu2Res = await api(`/api/follow-ups/${fu2.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: {
        assignedToUserId: partner2.id,
      },
    });
    assert.strictEqual(transferFu2Res.status, 200, 'Admin reassigns schedule 2 to Partner 2');

    const unassignP1FromARes = await api('/api/users/unassign', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        partnerUserId: partner1.id,
        customerId: customerA.id,
        sourceType: 'ALL',
      },
    });
    assert.strictEqual(unassignP1FromARes.status, 200);

    // Assign Customer A directly to Partner 2 as well
    await api('/api/users/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        userId: partner2.id,
        customerIds: [customerA.id],
      },
    });

    // Verify Partner 1 STILL sees Customer A in list and detail as HISTORICAL
    const p1ListAfterTransfer = await api('/api/customers', { cookie: p1Cookie });
    assert.strictEqual(p1ListAfterTransfer.status, 200);
    const customerAForP1 = p1ListAfterTransfer.body.data.find((c: any) => c.id === customerA.id);
    assert.ok(customerAForP1, 'Partner 1 must still see Customer A after assignment transfer');
    assert.strictEqual(customerAForP1.isCurrentlyAssignedToMe, false);
    assert.strictEqual(customerAForP1.isHistoricalForMe, true);
    assert.strictEqual(customerAForP1.assignmentStatus, 'HISTORICAL');
    assert.strictEqual(customerAForP1.canEditCustomer, false);

    const p1DetailA = await api(`/api/customers/${customerA.id}`, { cookie: p1Cookie });
    assert.strictEqual(p1DetailA.status, 200, 'Partner 1 can view detail of historical Customer A');
    assert.strictEqual(p1DetailA.body.data.isHistoricalForMe, true);
    assert.strictEqual(p1DetailA.body.data.canEditCustomer, false);
    console.log('✓ TEST 2 PASSED: Partner 1 still sees Customer A as HISTORICAL after transfer to Partner 2.\n');

    // =========================================================================
    // TEST 3: Partner thấy lịch trước đây từng được giao cho mình
    // =========================================================================
    console.log('[TEST 3] Partner 1 vẫn thấy các lịch chăm sóc từng được giao cho mình...');
    const p1FollowUpsRes = await api('/api/follow-ups', { cookie: p1Cookie });
    assert.strictEqual(p1FollowUpsRes.status, 200);
    const p1Fu1 = p1FollowUpsRes.body.data.find((f: any) => f.id === fu1.id);
    const p1Fu2 = p1FollowUpsRes.body.data.find((f: any) => f.id === fu2.id);
    assert.ok(p1Fu1, 'Partner 1 must still see completed schedule fu1');
    assert.ok(p1Fu2, 'Partner 1 must still see transferred schedule fu2 in historical scope');
    assert.strictEqual(p1Fu2.isCurrentlyAssignedToMe, false);
    assert.strictEqual(p1Fu2.isHistoricalForMe, true);
    assert.strictEqual(p1Fu2.assignmentStatus, 'HISTORICAL');
    assert.strictEqual(p1Fu2.canEdit, false);

    // Direct detail endpoint GET /api/follow-ups/:id also works for historical schedule
    const p1Fu2Detail = await api(`/api/follow-ups/${fu2.id}`, { cookie: p1Cookie });
    assert.strictEqual(p1Fu2Detail.status, 200);
    assert.strictEqual(p1Fu2Detail.body.data.isHistoricalForMe, true);
    assert.strictEqual(p1Fu2Detail.body.data.canEdit, false);
    console.log('✓ TEST 3 PASSED: Partner 1 sees both completed and transferred historical schedules.\n');

    // =========================================================================
    // TEST 4: Partner không thấy lịch chỉ được giao cho Partner khác
    // =========================================================================
    console.log('[TEST 4] Tạo lịch chăm sóc mới chỉ giao cho Partner 2 trên cùng Customer A...');
    const createFu3Res = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerId: customerA.id,
        title: `P2 Exclusive Schedule ${ts}`,
        description: 'Only ever assigned to Partner 2',
        dueAt: new Date(Date.now() + 10800_000).toISOString(),
        assignedToUserId: partner2.id,
      },
    });
    assert.strictEqual(createFu3Res.status, 201);
    const fu3OnlyP2 = createFu3Res.body.data;
    createdFollowUpIds.push(fu3OnlyP2.id);

    // Partner 1 must NOT see fu3OnlyP2 in GET /api/follow-ups
    const p1FollowUpsCheck = await api('/api/follow-ups', { cookie: p1Cookie });
    const leakedInList = p1FollowUpsCheck.body.data.find((f: any) => f.id === fu3OnlyP2.id);
    assert.strictEqual(leakedInList, undefined, 'Partner 1 must NOT see schedule assigned only to Partner 2');

    // Partner 1 must NOT see fu3OnlyP2 via direct GET /api/follow-ups/:id even if knowing ID
    const p1DirectFu3 = await api(`/api/follow-ups/${fu3OnlyP2.id}`, { cookie: p1Cookie });
    assert.ok(
      p1DirectFu3.status === 403 || p1DirectFu3.status === 404,
      `Direct access to Partner 2 exclusive schedule must return 403 or 404 (got ${p1DirectFu3.status})`
    );
    console.log('✓ TEST 4 PASSED: Partner 1 cannot see schedule exclusively assigned to Partner 2.\n');

    // =========================================================================
    // TEST 5: Partner cũ không thể sửa hoặc hoàn thành lịch đã chuyển giao (và customer lịch sử)
    // =========================================================================
    console.log('[TEST 5] Kiểm tra Partner 1 (cũ) bị chặn chỉnh sửa/hoàn thành lịch đã chuyển giao...');
    const p1PatchTransferredFu = await api(`/api/follow-ups/${fu2.id}`, {
      method: 'PATCH',
      cookie: p1Cookie,
      body: { status: 'COMPLETED' },
    });
    assert.strictEqual(
      p1PatchTransferredFu.status,
      403,
      'Partner 1 must receive 403 Forbidden when trying to complete transferred schedule fu2'
    );

    const p1BulkCompleteTransferredFu = await api('/api/follow-ups/bulk-complete', {
      method: 'POST',
      cookie: p1Cookie,
      body: { ids: [fu2.id] },
    });
    assert.strictEqual(
      p1BulkCompleteTransferredFu.status,
      403,
      'Partner 1 must receive 403 Forbidden when trying to bulk-complete transferred schedule fu2'
    );

    // Partner 1 also cannot mutate historical Customer A
    const p1PatchCustomerA = await api(`/api/customers/${customerA.id}`, {
      method: 'PATCH',
      cookie: p1Cookie,
      body: { overallStatus: 'DANG_TU_VAN' },
    });
    assert.strictEqual(p1PatchCustomerA.status, 403, 'Partner 1 cannot update historical Customer A');

    const p1CreateNoteOnHistoricalA = await api(`/api/customers/${customerA.id}/notes`, {
      method: 'POST',
      cookie: p1Cookie,
      body: { content: 'Should fail on historical customer' },
    });
    assert.strictEqual(p1CreateNoteOnHistoricalA.status, 403, 'Partner 1 cannot add note to historical Customer A');

    const p1CreateScheduleOnHistoricalA = await api('/api/follow-ups', {
      method: 'POST',
      cookie: p1Cookie,
      body: {
        customerId: customerA.id,
        title: 'Unauthorized new schedule by P1',
        dueAt: new Date(Date.now() + 86400_000).toISOString(),
      },
    });
    assert.strictEqual(
      p1CreateScheduleOnHistoricalA.status,
      403,
      'Partner 1 cannot create new follow-up on historical Customer A'
    );
    console.log('✓ TEST 5 PASSED: Historical partner is strictly read-only on transferred schedule and customer.\n');

    // =========================================================================
    // TEST 6: Partner hiện tại có thể cập nhật lịch được giao cho mình
    // =========================================================================
    console.log('[TEST 6] Kiểm tra Partner 2 (hiện tại) cập nhật và hoàn thành lịch được giao...');
    const p2CompleteFu2 = await api(`/api/follow-ups/${fu2.id}`, {
      method: 'PATCH',
      cookie: p2Cookie,
      body: { status: 'COMPLETED' },
    });
    assert.strictEqual(p2CompleteFu2.status, 200, 'Partner 2 (current assignee) can complete fu2');
    assert.strictEqual(p2CompleteFu2.body.data.status, 'COMPLETED');

    const p2UpdateCustomerA = await api(`/api/customers/${customerA.id}`, {
      method: 'PATCH',
      cookie: p2Cookie,
      body: { overallStatus: 'DANG_TU_VAN' },
    });
    assert.strictEqual(p2UpdateCustomerA.status, 200, 'Partner 2 (current assignee) can update Customer A status');

    // And Partner 1 can now see the updated COMPLETED status of fu2 in their historical view!
    const p1ViewFu2AfterP2Complete = await api(`/api/follow-ups/${fu2.id}`, { cookie: p1Cookie });
    assert.strictEqual(p1ViewFu2AfterP2Complete.status, 200);
    assert.strictEqual(p1ViewFu2AfterP2Complete.body.data.status, 'COMPLETED');
    console.log('✓ TEST 6 PASSED: Current Partner 2 can update/complete schedule and customer.\n');

    // =========================================================================
    // TEST 7: Thay đổi ID trong URL/request không vượt qua authorization (IDOR)
    // =========================================================================
    console.log('[TEST 7] Kiểm tra chống IDOR khi thay đổi ID trên URL và payload...');
    const p1IdorCustomerGet = await api(`/api/customers/${customerUnassigned.id}`, { cookie: p1Cookie });
    assert.strictEqual(p1IdorCustomerGet.status, 404, 'IDOR GET unassigned customer must return 404');

    const p1IdorCustomerPatch = await api(`/api/customers/${customerUnassigned.id}`, {
      method: 'PATCH',
      cookie: p1Cookie,
      body: { overallStatus: 'DANG_TU_VAN' },
    });
    assert.strictEqual(p1IdorCustomerPatch.status, 404, 'IDOR PATCH unassigned customer must return 404');

    const p1IdorFollowUpPatch = await api(`/api/follow-ups/${fu3OnlyP2.id}`, {
      method: 'PATCH',
      cookie: p1Cookie,
      body: { status: 'COMPLETED' },
    });
    assert.ok(
      p1IdorFollowUpPatch.status === 403 || p1IdorFollowUpPatch.status === 404,
      `IDOR PATCH another partner schedule must return 403 or 404 (got ${p1IdorFollowUpPatch.status})`
    );

    // Partner 2 trying to access Partner 1's Customer B
    const p2IdorCustomerB = await api(`/api/customers/${customerB.id}`, { cookie: p2Cookie });
    assert.strictEqual(p2IdorCustomerB.status, 404, 'Partner 2 cannot access Partner 1 Customer B');

    // Spoofing assignedToUserId in query string does not leak Partner 2's schedules to Partner 1
    const p1SpoofQuery = await api(`/api/follow-ups?assignedToUserId=${partner2.id}`, { cookie: p1Cookie });
    assert.strictEqual(p1SpoofQuery.status, 200);
    assert.strictEqual(
      p1SpoofQuery.body.data.some((f: any) => f.id === fu3OnlyP2.id),
      false,
      'Spoofing assignedToUserId query param must not leak Partner 2 schedules'
    );
    console.log('✓ TEST 7 PASSED: IDOR attempts across URLs, bodies, and query params are blocked.\n');

    // =========================================================================
    // TEST 8: ADMIN vẫn truy cập và quản lý được dữ liệu theo quyền hiện có
    // =========================================================================
    console.log('[TEST 8] Kiểm tra quyền quản lý toàn diện của ADMIN...');
    const adminGetUnassigned = await api(`/api/customers/${customerUnassigned.id}`, { cookie: adminCookie });
    assert.strictEqual(adminGetUnassigned.status, 200, 'Admin can view any customer');

    const adminDetailA = await api(`/api/customers/${customerA.id}`, { cookie: adminCookie });
    assert.strictEqual(adminDetailA.status, 200);
    // Admin sees ALL 3 schedules on Customer A (fu1, fu2, fu3OnlyP2)
    const adminFollowUpIdsOnA = (adminDetailA.body.data.followUps || []).map((f: any) => f.id);
    assert.ok(adminFollowUpIdsOnA.includes(fu1.id), 'Admin sees fu1');
    assert.ok(adminFollowUpIdsOnA.includes(fu2.id), 'Admin sees fu2');
    assert.ok(adminFollowUpIdsOnA.includes(fu3OnlyP2.id), 'Admin sees fu3OnlyP2');

    const adminPatchFu3 = await api(`/api/follow-ups/${fu3OnlyP2.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { title: `P2 Exclusive Schedule Updated By Admin ${ts}` },
    });
    assert.strictEqual(adminPatchFu3.status, 200, 'Admin can edit any schedule');
    console.log('✓ TEST 8 PASSED: ADMIN retains full access and management across all records.\n');

    // =========================================================================
    // TEST 9: Search, filter, pagination không làm mất dữ liệu lịch sử được phép xem
    // =========================================================================
    console.log('[TEST 9] Kiểm tra search, filter (assignmentScope), pagination với dữ liệu lịch sử...');
    // Partner 1 has:
    // - customerB (CURRENT)
    // - customerA (HISTORICAL)
    const p1ScopeAll = await api(`/api/customers?search=${ts}&assignmentScope=all&limit=10`, { cookie: p1Cookie });
    assert.strictEqual(p1ScopeAll.status, 200);
    const allIds = p1ScopeAll.body.data.map((c: any) => c.id);
    assert.ok(allIds.includes(customerA.id), 'assignmentScope=all includes historical Customer A');
    assert.ok(allIds.includes(customerB.id), 'assignmentScope=all includes current Customer B');

    const p1ScopeCurrent = await api(`/api/customers?search=${ts}&assignmentScope=current&limit=10`, {
      cookie: p1Cookie,
    });
    assert.strictEqual(p1ScopeCurrent.status, 200);
    const currentIds = p1ScopeCurrent.body.data.map((c: any) => c.id);
    assert.ok(currentIds.includes(customerB.id), 'assignmentScope=current includes Customer B');
    assert.strictEqual(currentIds.includes(customerA.id), false, 'assignmentScope=current excludes Historical Customer A');

    const p1ScopeHistorical = await api(`/api/customers?search=${ts}&assignmentScope=historical&limit=10`, {
      cookie: p1Cookie,
    });
    assert.strictEqual(p1ScopeHistorical.status, 200);
    const historicalIds = p1ScopeHistorical.body.data.map((c: any) => c.id);
    assert.ok(historicalIds.includes(customerA.id), 'assignmentScope=historical includes Customer A');
    assert.strictEqual(historicalIds.includes(customerB.id), false, 'assignmentScope=historical excludes Current Customer B');

    // FollowUps filter by assignmentScope for Partner 1
    const p1FuScopeHistorical = await api('/api/follow-ups?assignmentScope=historical&limit=50', {
      cookie: p1Cookie,
    });
    assert.strictEqual(p1FuScopeHistorical.status, 200);
    const p1HistFuIds = p1FuScopeHistorical.body.data.map((f: any) => f.id);
    assert.ok(p1HistFuIds.includes(fu2.id), 'FollowUp assignmentScope=historical includes transferred schedule fu2');
    assert.strictEqual(
      p1HistFuIds.includes(fu3OnlyP2.id),
      false,
      'FollowUp assignmentScope=historical never includes Partner 2 exclusive schedule'
    );
    console.log('✓ TEST 9 PASSED: Search, assignmentScope filters, and pagination preserve historical data accurately.\n');

    // =========================================================================
    // TEST 10: Customer history và care schedule history không bị trộn lẫn sai phạm vi
    // =========================================================================
    console.log('[TEST 10] Kiểm tra cô lập phạm vi giữa Customer history và Care schedule history...');
    // When Partner 1 fetches Customer A detail (GET /api/customers/:id),
    // customer.followUps MUST contain fu1 and fu2 (which Partner 1 was assigned to),
    // and MUST NOT contain fu3OnlyP2 (which was only ever assigned to Partner 2)!
    const p1CustomerADetail = await api(`/api/customers/${customerA.id}`, { cookie: p1Cookie });
    assert.strictEqual(p1CustomerADetail.status, 200);
    const p1FollowUpsOnCustomerA = p1CustomerADetail.body.data.followUps || [];
    const p1FollowUpIdsOnCustomerA = p1FollowUpsOnCustomerA.map((f: any) => f.id);

    assert.ok(p1FollowUpIdsOnCustomerA.includes(fu1.id), 'Customer A detail for P1 includes P1 completed schedule fu1');
    assert.ok(p1FollowUpIdsOnCustomerA.includes(fu2.id), 'Customer A detail for P1 includes P1 transferred schedule fu2');
    assert.strictEqual(
      p1FollowUpIdsOnCustomerA.includes(fu3OnlyP2.id),
      false,
      'CRITICAL: Customer A detail for P1 MUST NOT leak P2 exclusive schedule fu3OnlyP2!'
    );

    // Check activities on Customer A for Partner 1: must NOT leak fu3OnlyP2 creation activity
    const p1ActivitiesOnCustomerA = p1CustomerADetail.body.data.activities || [];
    const leakedActivity = p1ActivitiesOnCustomerA.find((act: any) =>
      typeof act.title === 'string' && act.title.includes(fu3OnlyP2.title)
    );
    assert.strictEqual(
      leakedActivity,
      undefined,
      'Customer A activities for P1 must NOT leak Partner 2 exclusive schedule activity'
    );
    console.log('✓ TEST 10 PASSED: Customer history does not leak another Partner’s private care schedules or activities.\n');

    console.log('==============================================================================');
    console.log('=== ALL 10 MANDATORY PARTNER HISTORICAL VISIBILITY TESTS PASSED 100% ===');
    console.log('==============================================================================\n');
  } finally {
    // Clean up all test data
    if (createdFollowUpIds.length > 0) {
      await prisma.followUp.deleteMany({ where: { id: { in: createdFollowUpIds } } }).catch(() => {});
    }
    const custIds = [customerA?.id, customerB?.id, customerUnassigned?.id].filter(Boolean) as string[];
    if (custIds.length > 0) {
      await prisma.customerActivity.deleteMany({ where: { customerId: { in: custIds } } }).catch(() => {});
      await prisma.customerNote.deleteMany({ where: { customerId: { in: custIds } } }).catch(() => {});
      await prisma.customerAssignmentGrant.deleteMany({ where: { customerId: { in: custIds } } }).catch(() => {});
      await prisma.customerAssignment.deleteMany({ where: { customerId: { in: custIds } } }).catch(() => {});
      await prisma.customer.deleteMany({ where: { id: { in: custIds } } }).catch(() => {});
    }
    const userIds = [adminUser?.id, partner1?.id, partner2?.id].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runHistoricalVisibilityTests().catch((err) => {
  console.error('\n[HISTORICAL VISIBILITY VERIFICATION FAILED]:', err);
  process.exit(1);
});


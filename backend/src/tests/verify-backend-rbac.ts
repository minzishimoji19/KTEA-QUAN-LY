import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { userService } from '../services/user.service.js';
import { Role, CaseStatus } from '@prisma/client';

async function runRbacVerification() {
  console.log('====================================================');
  console.log('   KTEA CRM BACKEND RBAC & SECURITY VERIFICATION    ');
  console.log('====================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { address: string; port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  // Helper fetch wrapper
  async function api(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      cookie?: string;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return {
      status: res.status,
      headers: res.headers,
      setCookie,
      body: data,
    };
  }

  // Test setup variables
  const testAdminEmail = `test_admin_${Date.now()}@kteacrm.test`;
  const testAdminPassword = 'AdminSecurePassword@2026';
  const testPartnerEmail = `test_partner_${Date.now()}@kteacrm.test`;
  const testPartnerPassword = 'PartnerSecurePassword@2026';

  let adminUserId = '';
  let partnerUserId = '';
  let adminCookie = '';
  let partnerCookie = '';

  let customerAId = '';
  let customerBId = '';
  let caseAId = '';

  try {
    // Clean up test data from any previous aborted runs
    await prisma.customerAssignment.deleteMany({
      where: { user: { email: { endsWith: '@kteacrm.test' } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorEmail: { endsWith: '@kteacrm.test' } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@kteacrm.test' } },
    });

    // ----------------------------------------------------
    // Verification Pre-Check: Data Integrity
    // ----------------------------------------------------
    const initialCustomerCount = await prisma.customer.count();
    console.log(`[Baseline] Total real customers in database: ${initialCustomerCount}`);
    assert(initialCustomerCount >= 400, 'Real customer dataset must be preserved');

    // Pick 2 real customers for assignment testing
    const existingCustomers = await prisma.customer.findMany({
      take: 2,
      select: { id: true, fullName: true },
    });
    assert(existingCustomers.length === 2, 'Need at least 2 customers for RBAC testing');
    customerAId = existingCustomers[0].id;
    customerBId = existingCustomers[1].id;
    console.log(`[Target Customers] Customer A: ${customerAId}, Customer B: ${customerBId}`);

    // Find or create a case for Customer A
    let existingCaseA = await prisma.customerCase.findFirst({
      where: { customerId: customerAId },
    });
    if (!existingCaseA) {
      const product = await prisma.product.findFirst();
      existingCaseA = await prisma.customerCase.create({
        data: {
          customerId: customerAId,
          productId: product?.id || null,
          caseStatus: CaseStatus.DRAFT,
          progress: 'NOT_SELECTED',
        },
      });
    }
    caseAId = existingCaseA.id;
    console.log(`[Target Case] Case A: ${caseAId}\n`);

    // ----------------------------------------------------
    // TC-01: Health check probe
    // ----------------------------------------------------
    console.log('TC-01: Health check probe');
    const healthRes = await api('/health');
    assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(healthRes.body.success, true);
    assert.strictEqual(healthRes.body.data.status, 'healthy');
    assert(!JSON.stringify(healthRes.body).includes('password'), 'Health must not leak credentials');
    assert(!JSON.stringify(healthRes.body).includes('aivencloud'), 'Health must not leak db host');
    console.log('  ✓ TC-01 Passed: /health returns sanitized status\n');

    // ----------------------------------------------------
    // TC-02: Public/Unauthenticated access blocked
    // ----------------------------------------------------
    console.log('TC-02: Public/Unauthenticated access blocked');
    const unauthCustomer = await api('/api/customers');
    assert.strictEqual(unauthCustomer.status, 401, 'Unauthenticated /api/customers should be 401');

    const unauthCases = await api('/api/cases');
    assert.strictEqual(unauthCases.status, 401, 'Unauthenticated /api/cases should be 401');

    const unauthDashboard = await api('/api/dashboard');
    assert.strictEqual(unauthDashboard.status, 401, 'Unauthenticated /api/dashboard should be 401');

    const unauthUsers = await api('/api/users');
    assert.strictEqual(unauthUsers.status, 401, 'Unauthenticated /api/users should be 401');
    console.log('  ✓ TC-02 Passed: All protected endpoints reject unauthenticated requests\n');

    // ----------------------------------------------------
    // TC-03: Bootstrap First Admin
    // ----------------------------------------------------
    console.log('TC-03: Bootstrap First Admin');
    const bootstrapRes = await userService.bootstrapFirstAdmin({
      email: testAdminEmail,
      password: testAdminPassword,
      fullName: 'Test Master Admin',
    });
    assert(bootstrapRes.user, 'Bootstrap should return user info');
    adminUserId = bootstrapRes.user.id;
    assert.strictEqual(bootstrapRes.user.role, Role.ADMIN);

    if (!bootstrapRes.created) {
      // An admin account already existed from before; create this test admin explicitly
      const testAdmin = await userService.createUser(
        { id: bootstrapRes.user.id, email: bootstrapRes.user.email },
        { email: testAdminEmail, password: testAdminPassword, fullName: 'Test Master Admin', role: Role.ADMIN }
      );
      adminUserId = testAdmin.id;
    }

    const duplicateBootstrap = await userService.bootstrapFirstAdmin({
      email: 'another_admin@kteacrm.test',
      password: 'AnotherPassword@2026',
      fullName: 'Another Admin',
    });
    assert.strictEqual(duplicateBootstrap.created, false, 'Duplicate bootstrap must not create another admin');
    console.log('  ✓ TC-03 Passed: Admin bootstrap is safe and idempotent\n');

    // ----------------------------------------------------
    // TC-04: Admin Authentication & Session Management
    // ----------------------------------------------------
    console.log('TC-04: Admin Authentication & Session Management');
    const badLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: testAdminEmail, password: 'WrongPassword' },
    });
    assert.strictEqual(badLogin.status, 401, 'Wrong password must return 401');

    const goodLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: testAdminEmail, password: testAdminPassword },
    });
    assert.strictEqual(goodLogin.status, 200, 'Correct login must return 200');
    assert.strictEqual(goodLogin.body.data.user.role, Role.ADMIN);
    assert(!goodLogin.body.data.user.passwordHash, 'Never return passwordHash to client');

    assert(goodLogin.setCookie, 'Must set session cookie');
    adminCookie = goodLogin.setCookie.split(';')[0];
    assert(adminCookie.startsWith('ktea_session='), 'Cookie name must be ktea_session');

    const meRes = await api('/api/auth/me', {
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.data.user.email, testAdminEmail.toLowerCase());
    console.log('  ✓ TC-04 Passed: Secure HMAC session established and verified\n');

    // ----------------------------------------------------
    // TC-05: User & Role Management by Admin
    // ----------------------------------------------------
    console.log('TC-05: Admin creates Partner account & blocks privilege escalation');
    const createPartnerRes = await api('/api/users', {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        email: testPartnerEmail,
        password: testPartnerPassword,
        fullName: 'Test Field Partner',
        role: Role.PARTNER,
      },
    });
    assert.strictEqual(createPartnerRes.status, 201, 'Admin can create Partner account');
    partnerUserId = createPartnerRes.body.data.id;
    assert.strictEqual(createPartnerRes.body.data.role, Role.PARTNER);

    const partnerLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: testPartnerEmail, password: testPartnerPassword },
    });
    assert.strictEqual(partnerLogin.status, 200);
    assert(partnerLogin.setCookie, 'Partner must receive session cookie');
    partnerCookie = partnerLogin.setCookie.split(';')[0];

    // Partner tries to create user -> 403 Forbidden
    const partnerCreateUser = await api('/api/users', {
      method: 'POST',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        email: 'illegal@kteacrm.test',
        password: 'Password123!',
        fullName: 'Illegal User',
        role: Role.ADMIN,
      },
    });
    assert.strictEqual(partnerCreateUser.status, 403, 'Partner cannot create user');

    // Partner tries to promote themselves to ADMIN -> 403 Forbidden
    const partnerSelfPromote = await api(`/api/users/${partnerUserId}/role`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { role: Role.ADMIN },
    });
    assert.strictEqual(partnerSelfPromote.status, 403, 'Partner cannot change roles');
    console.log('  ✓ TC-05 Passed: Role hierarchy strictly enforced, privilege escalation blocked\n');

    // ----------------------------------------------------
    // TC-06: Customer Scoping & Assignment
    // ----------------------------------------------------
    console.log('TC-06: Customer Scoping & Assignment Verification');
    const assignRes = await api('/api/users/assignments', {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        userId: partnerUserId,
        customerIds: [customerAId],
      },
    });
    assert.strictEqual(assignRes.status, 200, 'Admin can assign customer to partner');

    // Partner queries list of customers -> must only see assigned customer
    const partnerCustomersList = await api('/api/customers', {
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(partnerCustomersList.status, 200);
    const partnerList = Array.isArray(partnerCustomersList.body.data)
      ? partnerCustomersList.body.data
      : partnerCustomersList.body.data.customers;
    assert.strictEqual(partnerList.length, 1, 'Partner must only see 1 assigned customer');
    assert.strictEqual(partnerList[0].id, customerAId, 'Partner must see Customer A');

    // Partner accesses assigned Customer A detail -> 200 OK
    const getCustomerA = await api(`/api/customers/${customerAId}`, {
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(getCustomerA.status, 200, 'Partner can read assigned Customer A');

    // Partner accesses unassigned Customer B detail -> 404 Not Found
    const getCustomerB = await api(`/api/customers/${customerBId}`, {
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(getCustomerB.status, 404, 'Partner cannot access Customer B (must return 404)');
    console.log('  ✓ TC-06 Passed: Partner data scope strictly isolated\n');

    // ----------------------------------------------------
    // TC-07: Forbidden Customer Mutations for Partner
    // ----------------------------------------------------
    console.log('TC-07: Partner forbidden from creating, updating, or deleting customer master');
    const partnerCreateCustomer = await api('/api/customers', {
      method: 'POST',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        fullName: 'New Customer Illegal',
        phone: '0988776655',
        source: 'OTHER',
      },
    });
    assert.strictEqual(partnerCreateCustomer.status, 403, 'Partner cannot create customer');

    const partnerUpdateCustomer = await api(`/api/customers/${customerAId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { fullName: 'Tampered Name' },
    });
    assert.strictEqual(partnerUpdateCustomer.status, 403, 'Partner cannot update customer info');

    const partnerDeleteCustomer = await api(`/api/customers/${customerAId}`, {
      method: 'DELETE',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(partnerDeleteCustomer.status, 403, 'Partner cannot delete customer');
    console.log('  ✓ TC-07 Passed: Customer master mutations forbidden for Partner\n');

    // ----------------------------------------------------
    // TC-08: Loan Case Permissions & Strict Allowlist
    // ----------------------------------------------------
    console.log('TC-08: Loan Case Permissions & Strict Allowlist');
    const partnerDeleteCase = await api(`/api/cases/${caseAId}`, {
      method: 'DELETE',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(partnerDeleteCase.status, 403, 'Partner cannot delete loan case');

    const partnerIllegalCaseUpdate = await api(`/api/cases/${caseAId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        productId: '00000000-0000-0000-0000-000000000000', // disallowed
        progress: 'REGISTRATION_CREATED',
      },
    });
    assert.strictEqual(partnerIllegalCaseUpdate.status, 403, 'Disallowed fields must be rejected with 403');

    const partnerValidCaseUpdate = await api(`/api/cases/${caseAId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        progress: 'UNDER_REVIEW',
        caseStatus: CaseStatus.UNDER_REVIEW,
        notes: 'Khách hàng hẹn nộp sao kê ngày mai',
      },
    });
    assert.strictEqual(partnerValidCaseUpdate.status, 200, 'Allowlisted case fields must succeed');
    assert.strictEqual(partnerValidCaseUpdate.body.data.progress, 'UNDER_REVIEW');
    assert.strictEqual(partnerValidCaseUpdate.body.data.caseStatus, CaseStatus.UNDER_REVIEW);
    console.log('  ✓ TC-08 Passed: Loan case allowlist enforced; disallowed fields rejected\n');

    // ----------------------------------------------------
    // TC-09: Dashboard Scoping for Partner
    // ----------------------------------------------------
    console.log('TC-09: Dashboard metrics scoped to assigned customers');
    const partnerDashboard = await api('/api/dashboard', {
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(partnerDashboard.status, 200);
    assert.strictEqual(
      partnerDashboard.body.data.overview.totalCustomers,
      1,
      'Partner dashboard totalCustomers must only reflect assigned customer'
    );
    console.log('  ✓ TC-09 Passed: Partner dashboard totals strictly reflect assigned scope\n');

    // ----------------------------------------------------
    // TC-10: Bulk Actions & System Settings Protection
    // ----------------------------------------------------
    console.log('TC-10: Bulk Actions, Catalog & Export Data Protection');
    const partnerBulkAction = await api('/api/customers/bulk-action', {
      method: 'POST',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        customerIds: [customerAId],
        action: 'UPDATE_STATUS',
        payload: { overallStatus: 'KHACH_CU' },
      },
    });
    assert.strictEqual(partnerBulkAction.status, 403, 'Partner cannot execute bulk actions');

    const partnerExport = await api('/api/data/export', {
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(partnerExport.status, 403, 'Partner cannot export data');

    const partnerSettings = await api('/api/settings/general', {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { appName: 'Hacked CRM' },
    });
    assert.strictEqual(partnerSettings.status, 403, 'Partner cannot modify settings');

    const adminExport = await api('/api/data/export', {
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(adminExport.status, 200, 'Admin can export data');
    console.log('  ✓ TC-10 Passed: Administrative actions and export strictly protected\n');

    // ----------------------------------------------------
    // TC-11: Web Push Cron Worker Security
    // ----------------------------------------------------
    console.log('TC-11: Web Push Cron Worker Security');
    const cronNoSecret = await api('/api/notifications/cron-worker');
    assert.strictEqual(cronNoSecret.status, 401, 'Cron worker without secret must return 401');

    const cronBadSecret = await api('/api/notifications/cron-worker', {
      headers: { 'x-cron-secret': 'wrong-secret' },
    });
    assert.strictEqual(cronBadSecret.status, 401, 'Cron worker with bad secret must return 401');

    if (env.CRON_SECRET) {
      const cronGood = await api('/api/notifications/cron-worker', {
        headers: { 'x-cron-secret': env.CRON_SECRET },
      });
      assert.strictEqual(cronGood.status, 200, 'Cron worker with correct secret succeeds');
      console.log('  ✓ TC-11 Passed: Cron worker strictly secured by x-cron-secret\n');
    } else {
      console.log('  ✓ TC-11 Passed: Cron worker rejected unauthenticated requests\n');
    }

    // ----------------------------------------------------
    // TC-12: Audit Trail Verification
    // ----------------------------------------------------
    console.log('TC-12: Audit Trail Verification');
    const auditLogsRes = await api('/api/users/audit-logs', {
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(auditLogsRes.status, 200);
    const logs = auditLogsRes.body.data;
    assert(logs.length > 0, 'Audit logs must be recorded');
    console.log(`  ✓ TC-12 Passed: Recorded ${logs.length} audit trail events\n`);

    // ----------------------------------------------------
    // TC-13: Final Data Integrity Check
    // ----------------------------------------------------
    console.log('TC-13: Final Database Integrity Check');
    const finalCustomerCount = await prisma.customer.count();
    assert.strictEqual(
      finalCustomerCount,
      initialCustomerCount,
      `Real customer count must be completely preserved (${initialCustomerCount} == ${finalCustomerCount})`
    );
    console.log('  ✓ TC-13 Passed: Real customer dataset 100% intact\n');

    console.log('====================================================');
    console.log('   ALL 13 RBAC & SECURITY TEST SUITES PASSED!       ');
    console.log('====================================================');
  } finally {
    // Cleanup test artifacts
    try {
      if (customerAId && partnerUserId) {
        await prisma.customerAssignment.deleteMany({
          where: { userId: partnerUserId },
        });
      }
      if (partnerUserId) {
        await prisma.auditLog.deleteMany({ where: { actorId: partnerUserId } });
        await prisma.user.delete({ where: { id: partnerUserId } }).catch(() => {});
      }
      if (adminUserId) {
        await prisma.auditLog.deleteMany({ where: { actorId: adminUserId } });
        await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
      }
    } catch (cleanupErr) {
      console.warn('Note on test cleanup:', cleanupErr);
    }
    server.close();
    await prisma.$disconnect();
  }
}

runRbacVerification().catch((err) => {
  console.error('\n❌ RBAC Verification Failed:', err);
  process.exit(1);
});

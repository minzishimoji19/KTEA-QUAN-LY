import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import { userService } from '../services/user.service.js';
import { Role, CustomerStatus } from '@prisma/client';

async function runVerification() {
  console.log('========================================================================');
  console.log('   VERIFY: PARTNER CUSTOMER CARE STATUS EDIT & SECURITY ENFORCEMENT    ');
  console.log('========================================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { address: string; port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

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

  const testAdminEmail = `admin_test_${Date.now()}@kteacrm.test`;
  const testAdminPassword = 'AdminPassword@2026';
  const testPartnerEmail = `partner_test_${Date.now()}@kteacrm.test`;
  const testPartnerPassword = 'PartnerPassword@2026';

  let adminUserId = '';
  let partnerUserId = '';
  let adminCookie = '';
  let partnerCookie = '';

  let customerAssignedId = '';
  let customerUnassignedId = '';
  const initialTotalCustomers = await prisma.customer.count();

  try {
    // 1. Create Admin & Partner users
    const bootstrapRes = await userService.bootstrapFirstAdmin({
      email: testAdminEmail,
      password: testAdminPassword,
      fullName: 'Verification Admin',
    });
    let adminCreator = bootstrapRes.user;
    if (!bootstrapRes.created) {
      const testAdmin = await userService.createUser(
        { id: bootstrapRes.user.id, email: bootstrapRes.user.email },
        { email: testAdminEmail, password: testAdminPassword, fullName: 'Verification Admin', role: Role.ADMIN }
      );
      adminUserId = testAdmin.id;
      adminCreator = testAdmin;
    } else {
      adminUserId = bootstrapRes.user.id;
    }

    const partner = await userService.createUser(
      { id: adminCreator.id, email: adminCreator.email },
      {
        email: testPartnerEmail,
        password: testPartnerPassword,
        fullName: 'Verification Partner',
        role: Role.PARTNER,
      }
    );
    partnerUserId = partner.id;

    // Login Admin
    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: testAdminEmail, password: testAdminPassword },
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login failed');
    adminCookie = adminLoginRes.setCookie ? adminLoginRes.setCookie.split(';')[0] : '';

    // Login Partner
    const partnerLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: testPartnerEmail, password: testPartnerPassword },
    });
    assert.strictEqual(partnerLoginRes.status, 200, 'Partner login failed');
    partnerCookie = partnerLoginRes.setCookie ? partnerLoginRes.setCookie.split(';')[0] : '';

    // Create 2 test customers via DB
    const custAssigned = await prisma.customer.create({
      data: {
        fullName: 'Khách Hàng Được Phân Công',
        phone: `0977${Math.floor(100000 + Math.random() * 900000)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
        note: 'Ghi chú ban đầu',
      },
    });
    customerAssignedId = custAssigned.id;

    const custUnassigned = await prisma.customer.create({
      data: {
        fullName: 'Khách Hàng KHÔNG Phân Công',
        phone: `0978${Math.floor(100000 + Math.random() * 900000)}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });
    customerUnassignedId = custUnassigned.id;

    // Assign customerAssigned to Partner
    await prisma.customerAssignment.create({
      data: {
        customerId: customerAssignedId,
        userId: partnerUserId,
        assignedById: adminUserId,
      },
    });

    // Create 1 follow-up for assigned customer to verify careCount integrity
    const testFollowUp = await prisma.followUp.create({
      data: {
        customerId: customerAssignedId,
        title: 'Lịch gọi tư vấn định kỳ',
        status: 'PENDING',
        dueAt: new Date(Date.now() + 86400000),
      },
    });

    console.log('Setup complete: Admin, Partner, and 2 test customers ready.\n');

    // =========================================================================
    // TC-01: ADMIN can edit customer care status and customer master fields
    // =========================================================================
    console.log('TC-01: ADMIN retains full update permissions...');
    const adminUpdateRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        fullName: 'Khách Hàng Được Phân Công (Đã Cập Nhật bởi Admin)',
        overallStatus: CustomerStatus.DANG_TIEP_CAN,
      },
    });
    assert.strictEqual(adminUpdateRes.status, 200, 'ADMIN update failed');
    assert.strictEqual(adminUpdateRes.body.data.overallStatus, CustomerStatus.DANG_TIEP_CAN);
    console.log('  ✓ TC-01 Passed: ADMIN successfully updated customer master & status\n');

    // =========================================================================
    // TC-02: PARTNER can update care status (overallStatus) of assigned customer
    // =========================================================================
    console.log('TC-02: PARTNER updates care status of assigned customer...');
    const partnerUpdateRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        overallStatus: CustomerStatus.DANG_TU_VAN,
      },
    });
    assert.strictEqual(partnerUpdateRes.status, 200, `PARTNER update failed: ${JSON.stringify(partnerUpdateRes.body)}`);
    assert.strictEqual(partnerUpdateRes.body.data.overallStatus, CustomerStatus.DANG_TU_VAN);
    console.log('  ✓ TC-02 Passed: PARTNER updated overallStatus to DANG_TU_VAN successfully\n');

    // =========================================================================
    // TC-03: Reloading / fetching customer detail retains the new status
    // =========================================================================
    console.log('TC-03: Verifying persistence on page reload / subsequent GET...');
    const partnerGetRes = await api(`/api/customers/${customerAssignedId}`, {
      cookie: partnerCookie,
    });
    assert.strictEqual(partnerGetRes.status, 200);
    assert.strictEqual(partnerGetRes.body.data.overallStatus, CustomerStatus.DANG_TU_VAN);
    assert.strictEqual(partnerGetRes.body.data.rawOverallStatus, CustomerStatus.DANG_TU_VAN);
    console.log('  ✓ TC-03 Passed: Reloaded data confirms persisted status DANG_TU_VAN\n');

    // =========================================================================
    // TC-04: PARTNER cannot update care status of unassigned customer
    // =========================================================================
    console.log('TC-04: PARTNER attempts to update unassigned customer...');
    const partnerForbiddenCustRes = await api(`/api/customers/${customerUnassignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        overallStatus: CustomerStatus.THANH_CONG,
      },
    });
    assert.ok(
      partnerForbiddenCustRes.status === 404 || partnerForbiddenCustRes.status === 403,
      `Expected 404 or 403 but got ${partnerForbiddenCustRes.status}`
    );
    console.log('  ✓ TC-04 Passed: PARTNER access to out-of-scope customer strictly rejected\n');

    // =========================================================================
    // TC-05: PARTNER cannot tamper with forbidden fields (fullName, phone, etc.)
    // =========================================================================
    console.log('TC-05: PARTNER attempts to tamper with restricted fields...');
    const partnerTamperNameRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        fullName: 'Hacked Name By Partner',
        overallStatus: CustomerStatus.THANH_CONG,
      },
    });
    assert.strictEqual(partnerTamperNameRes.status, 403, 'Partner tampering fullName must return 403 Forbidden');

    const partnerTamperPhoneRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        phone: '0900000000',
        overallStatus: CustomerStatus.THANH_CONG,
      },
    });
    assert.strictEqual(partnerTamperPhoneRes.status, 403, 'Partner tampering phone must return 403 Forbidden');

    const partnerTamperNoteRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: {
        note: 'Tampered note via master update',
        overallStatus: CustomerStatus.THANH_CONG,
      },
    });
    assert.strictEqual(partnerTamperNoteRes.status, 403, 'Partner tampering note must return 403 Forbidden');
    console.log('  ✓ TC-05 Passed: All attempts by PARTNER to modify restricted fields rejected with 403\n');

    // =========================================================================
    // TC-06: PARTNER cannot escalate privileges (create customer, change roles, assignments)
    // =========================================================================
    console.log('TC-06: PARTNER attempts administrative operations directly...');
    const partnerCreateCustRes = await api('/api/customers', {
      method: 'POST',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { fullName: 'New Customer By Partner', phone: '0912345678' },
    });
    assert.strictEqual(partnerCreateCustRes.status, 403, 'Partner cannot create customer');

    const partnerDeleteCustRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'DELETE',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
    });
    assert.strictEqual(partnerDeleteCustRes.status, 403, 'Partner cannot delete customer');

    const partnerChangeRoleRes = await api(`/api/users/${partnerUserId}/role`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { role: Role.ADMIN },
    });
    assert.strictEqual(partnerChangeRoleRes.status, 403, 'Partner cannot change user role');

    const partnerAssignRes = await api('/api/users/assignments', {
      method: 'POST',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { customerId: customerUnassignedId, partnerUserId },
    });
    assert.strictEqual(partnerAssignRes.status, 403, 'Partner cannot assign customers');
    console.log('  ✓ TC-06 Passed: Administrative actions strictly forbidden for PARTNER\n');

    // =========================================================================
    // TC-07: Validation rejects invalid status values
    // =========================================================================
    console.log('TC-07: Invalid status validation...');
    const invalidStatusRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { overallStatus: 'INVALID_ARBITRARY_STATUS' },
    });
    assert.ok(
      invalidStatusRes.status === 400 || invalidStatusRes.status === 422,
      `Invalid status must return 400 or 422, got ${invalidStatusRes.status}`
    );
    console.log('  ✓ TC-07 Passed: Invalid status rejected with validation error (422/400)\n');

    // =========================================================================
    // TC-08: Care count & follow-up integrity preserved
    // =========================================================================
    console.log('TC-08: Verifying care task & schedule integrity...');
    // Partner transitions status to THANH_CONG
    const partnerFinishStatusRes = await api(`/api/customers/${customerAssignedId}`, {
      method: 'PATCH',
      cookie: partnerCookie,
      headers: { 'x-ktea-request': '1' },
      body: { overallStatus: CustomerStatus.THANH_CONG },
    });
    assert.strictEqual(partnerFinishStatusRes.status, 200);

    // Check follow-up remains PENDING and careCount remains 1
    const checkCustDetail = await api(`/api/customers/${customerAssignedId}`, {
      cookie: partnerCookie,
    });
    assert.strictEqual(checkCustDetail.body.data.careCount, 1, 'Care count must not arbitrarily change');

    const dbFollowUp = await prisma.followUp.findUnique({
      where: { id: testFollowUp.id },
    });
    assert.strictEqual(dbFollowUp?.status, 'PENDING', 'Follow-up must NOT be auto-completed by overall status change');
    console.log('  ✓ TC-08 Passed: Care count preserved and follow-up not mutated\n');

    // =========================================================================
    // TC-09: Audit log recorded the transitions
    // =========================================================================
    console.log('TC-09: Verifying audit trail for status update...');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Customer',
        entityId: customerAssignedId,
        action: 'UPDATE_CUSTOMER_STATUS',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(auditLogs.length >= 2, `Expected at least 2 status update logs, got ${auditLogs.length}`);
    const latestLog = auditLogs[0];
    const parsedDetails =
      typeof latestLog.details === 'string' ? JSON.parse(latestLog.details) : latestLog.details;
    assert.strictEqual(parsedDetails?.newStatus, CustomerStatus.THANH_CONG);
    console.log(`  ✓ TC-09 Passed: Audit logs verified (${auditLogs.length} events logged with actor & previous/new status)\n`);

    // =========================================================================
    // TC-10: Database Integrity Check
    // =========================================================================
    console.log('TC-10: Verifying database dataset integrity...');
    const currentCustomerCount = await prisma.customer.count();
    // We added 2 test customers, so count must be initialTotalCustomers + 2
    assert.strictEqual(currentCustomerCount, initialTotalCustomers + 2);
    console.log('  ✓ TC-10 Passed: No real customer records were deleted or corrupted\n');

    console.log('========================================================================');
    console.log('   ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY!                      ');
    console.log('========================================================================\n');
  } finally {
    // Clean up only our created test artifacts
    if (customerAssignedId || customerUnassignedId) {
      await prisma.customerActivity.deleteMany({
        where: { customerId: { in: [customerAssignedId, customerUnassignedId] } },
      });
      await prisma.followUp.deleteMany({
        where: { customerId: { in: [customerAssignedId, customerUnassignedId] } },
      });
      await prisma.customerAssignment.deleteMany({
        where: { customerId: { in: [customerAssignedId, customerUnassignedId] } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: { in: [adminUserId, partnerUserId] } },
            { entityId: { in: [customerAssignedId, customerUnassignedId] } },
          ],
        },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: [customerAssignedId, customerUnassignedId] } },
      });
    }
    if (adminUserId || partnerUserId) {
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, partnerUserId] } },
      });
    }

    server.close();
  }
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

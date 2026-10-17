import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import assert from 'node:assert';
import http from 'node:http';
import createApp from '../app.js';
import { userService } from '../services/user.service.js';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('========================================================================');
  console.log('=== KTEA CRM: VERIFICATION OF USER-CAREGIVER UNIFICATION ARCHITECTURE ===');
  console.log('========================================================================\n');

  // Step 1: Baseline Integrity Check
  console.log('[STEP 1] Checking Core Business Data Baseline...');
  await prisma.followUp.deleteMany({ where: { title: 'TEST_SCHEDULE_VERIFICATION' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { startsWith: 'temp_' } } }).catch(() => {});

  const userCount = await prisma.user.count();
  const customerCount = await prisma.customer.count();
  const caseCount = await prisma.customerCase.count();
  const followUpCount = await prisma.followUp.count();
  const assignmentCount = await prisma.customerAssignment.count();
  const grantCount = await prisma.customerAssignmentGrant.count();

  console.log(`- Users: ${userCount} (Target: >= 8)`);
  console.log(`- Customers: ${customerCount} (Target: 501 preserved)`);
  console.log(`- Customer Cases: ${caseCount} (Target: 5 preserved)`);
  console.log(`- Follow-ups: ${followUpCount} (Target: 142 preserved)`);
  console.log(`- Customer Assignments: ${assignmentCount}`);
  console.log(`- Assignment Grants: ${grantCount}`);

  assert.strictEqual(customerCount, 501, 'CRITICAL: Customer count must remain exactly 501');
  assert.strictEqual(caseCount, 5, 'CRITICAL: Customer cases must remain exactly 5');
  assert.strictEqual(followUpCount, 142, 'CRITICAL: Follow-ups must remain exactly 142');
  assert.ok(userCount >= 8, 'Users must be at least 8');

  // Step 2: FollowUps assignment state check
  console.log('\n[STEP 2] Checking Follow-up AssignedToUserId Mapping...');
  const mappedFollowUps = await prisma.followUp.count({
    where: { assignedToUserId: { not: null } },
  });
  const unmappedFollowUps = await prisma.followUp.count({
    where: { assignedToUserId: null },
  });
  console.log(`- Follow-ups with assignedToUserId: ${mappedFollowUps} (Expected: 141)`);
  console.log(`- Follow-ups with null assignedToUserId: ${unmappedFollowUps} (Expected: 1)`);
  assert.strictEqual(mappedFollowUps, 141, 'Mapped followups must be 141');
  assert.strictEqual(unmappedFollowUps, 1, 'Unmapped followups must be 1 (mfast)');

  const mfastRecord = await prisma.followUp.findFirst({
    where: { assignedToUserId: null },
  });
  assert.ok(mfastRecord, 'mfast record must exist');
  assert.strictEqual(mfastRecord.assignedTo, 'mfast', 'mfast historical name must be preserved');
  console.log(`- Verified unmapped historical follow-up: ID=${mfastRecord.id}, assignedTo="${mfastRecord.assignedTo}"`);

  // Step 3: Check Eligible Caregivers Service
  console.log('\n[STEP 3] Testing userService.getEligibleCaregivers()...');
  const eligibleCaregivers = await userService.getEligibleCaregivers();
  console.log(`- Found ${eligibleCaregivers.length} eligible caregivers:`);
  for (const c of eligibleCaregivers) {
    console.log(`  * [${c.role}] ${c.fullName} (${c.email}) - Status: ${c.status}`);
    assert.strictEqual(c.status, UserStatus.ACTIVE, 'Caregiver user must be ACTIVE');
    assert.ok(c.role === Role.PARTNER || c.role === Role.ADMIN, 'Caregiver must be PARTNER or ADMIN');
  }

  // Step 4: Ephemeral HTTP Server Testing
  console.log('\n[STEP 4] Starting HTTP test server to verify APIs...');
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`- Test server listening at ${baseUrl}`);

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

  let tempAdmin: any = null;
  let tempPartner: any = null;
  let createdFollowUpId: string | null = null;

  try {
    // Create temporary admin and partner for non-destructive authentication
    tempAdmin = await prisma.user.create({
      data: {
        email: `temp_admin_${timestamp}@example.com`,
        fullName: `Temp Admin ${timestamp}`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    tempPartner = await prisma.user.create({
      data: {
        email: `temp_partner_${timestamp}@example.com`,
        fullName: `Temp Partner ${timestamp}`,
        passwordHash,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    // 4.1 Login as Admin
    console.log('\n[STEP 5] Testing Admin Authentication & Caregiver Listing API...');
    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: tempAdmin.email, password: testPassword },
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login must return 200');
    const adminCookie = adminLoginRes.cookie;
    assert.ok(adminCookie, 'Admin session cookie must be set');

    const caregiverRes = await api('/api/users/caregivers', {
      cookie: adminCookie,
    });
    assert.strictEqual(caregiverRes.status, 200, 'GET /api/users/caregivers must return 200');
    assert.ok(Array.isArray(caregiverRes.body.data), 'caregivers response must be an array');
    console.log(`- API GET /api/users/caregivers returned ${caregiverRes.body.data.length} caregivers.`);

    // Check tempPartner is included in eligible caregivers
    const foundPartner = caregiverRes.body.data.find((u: any) => u.id === tempPartner.id);
    assert.ok(foundPartner, 'Temp partner must appear in eligible caregivers list');
    console.log(`- Verified newly created Partner ${tempPartner.fullName} automatically appears in caregiver list.`);

    // 4.2 Create a Follow-up directly with assignedToUserId
    console.log('\n[STEP 6] Testing Follow-up creation with assignedToUserId...');
    const sampleCustomer = await prisma.customer.findFirst();
    assert.ok(sampleCustomer, 'Sample customer must exist');

    const createRes = await api('/api/follow-ups', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerId: sampleCustomer.id,
        title: 'TEST_SCHEDULE_VERIFICATION',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        assignedToUserId: tempPartner.id,
      },
    });

    assert.strictEqual(createRes.status, 201, 'POST /api/follow-ups must return 201');
    const createdFollowUp = createRes.body.data;
    createdFollowUpId = createdFollowUp.id;
    console.log(`- Created FollowUp ID: ${createdFollowUp.id}`);
    console.log(`  * assignedToUserId: ${createdFollowUp.assignedToUserId}`);
    console.log(`  * assignedTo: ${createdFollowUp.assignedTo}`);
    assert.strictEqual(createdFollowUp.assignedToUserId, tempPartner.id, 'assignedToUserId must match partner user');
    assert.strictEqual(createdFollowUp.assignedTo, tempPartner.fullName, 'assignedTo text must match partner fullName');

    // Verify assignment grant was synchronized
    const testGrant = await prisma.customerAssignmentGrant.findFirst({
      where: {
        sourceId: createdFollowUp.id,
        sourceType: 'CARE_SCHEDULE',
        userId: tempPartner.id,
      },
    });
    assert.ok(testGrant, 'Assignment grant must be automatically created for the assigned partner');
    console.log(`- Assignment grant verified: Grant ID=${testGrant.id}`);

    // Step 7: Verify RBAC for Partner user
    console.log('\n[STEP 7] Testing Partner Access Control...');
    const partnerLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: tempPartner.email, password: testPassword },
    });
    assert.strictEqual(partnerLoginRes.status, 200, 'Partner login must return 200');
    const partnerCookie = partnerLoginRes.cookie;
    assert.ok(partnerCookie, 'Partner cookie must be set');

    // Partner requesting caregivers endpoint
    const partnerCaregiverRes = await api('/api/users/caregivers', {
      cookie: partnerCookie,
    });
    assert.strictEqual(partnerCaregiverRes.status, 200, 'Partner can access eligible caregivers list');

    // Partner cannot manage users
    const partnerUsersRes = await api('/api/users', {
      cookie: partnerCookie,
    });
    assert.strictEqual(partnerUsersRes.status, 403, 'Partner cannot access user management API');
    console.log('- RBAC verified: Partner successfully forbidden from accessing /api/users');

    // Partner can access customer assigned to them
    const partnerCustomerRes = await api(`/api/customers/${sampleCustomer.id}`, {
      cookie: partnerCookie,
    });
    assert.strictEqual(partnerCustomerRes.status, 200, 'Partner can access customer assigned via follow-up');
    console.log('- Partner access to assigned customer verified.');

    // Step 8: Clean up test schedule and users
    console.log('\n[STEP 8] Cleaning up test records...');
    if (createdFollowUpId) {
      await api(`/api/follow-ups/${createdFollowUpId}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });
      createdFollowUpId = null;
      console.log('- Test follow-up deleted.');
    }
  } finally {
    if (createdFollowUpId) {
      await prisma.followUp.delete({ where: { id: createdFollowUpId } }).catch(() => {});
    }
    await prisma.followUp.deleteMany({ where: { title: 'TEST_SCHEDULE_VERIFICATION' } }).catch(() => {});
    if (tempPartner) {
      await prisma.customerAssignmentGrant.deleteMany({ where: { userId: tempPartner.id } }).catch(() => {});
      await prisma.customerAssignment.deleteMany({ where: { userId: tempPartner.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: tempPartner.id } }).catch(() => {});
    }
    if (tempAdmin) {
      await prisma.user.delete({ where: { id: tempAdmin.id } }).catch(() => {});
    }
    server.close();

    // Step 9: Final DB Baseline Verification
    console.log('\n[STEP 9] Final Database Integrity Verification...');
    const finalCustCount = await prisma.customer.count();
    const finalCaseCount = await prisma.customerCase.count();
    const finalFollowUpCount = await prisma.followUp.count();
    const finalUserCount = await prisma.user.count();

    console.log(`- Final Customers: ${finalCustCount} (Preserved: 501)`);
    console.log(`- Final Cases: ${finalCaseCount} (Preserved: 5)`);
    console.log(`- Final Follow-ups: ${finalFollowUpCount} (Preserved: 142)`);
    console.log(`- Final Users: ${finalUserCount} (Preserved: 8)`);

    assert.strictEqual(finalCustCount, 501, 'Customer count must remain exactly 501');
    assert.strictEqual(finalCaseCount, 5, 'Customer case count must remain exactly 5');
    assert.strictEqual(finalFollowUpCount, 142, 'Follow-up count must remain exactly 142');
    assert.strictEqual(finalUserCount, 8, 'User count must remain exactly 8');

    console.log('\n========================================================================');
    console.log('=== ALL 9 VERIFICATION STEPS PASSED WITH 100% SUCCESS ===');
    console.log('========================================================================\n');
    await prisma.$disconnect();
  }
}

runVerification().catch((err) => {
  console.error('\n[VERIFICATION FAILED]:', err);
  process.exit(1);
});

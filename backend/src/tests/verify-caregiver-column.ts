import { PrismaClient, Role, UserStatus } from '@prisma/client';
import assert from 'node:assert';
import http from 'node:http';
import createApp from '../app.js';
import { customerService } from '../services/customer.service.js';
import { userService } from '../services/user.service.js';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('========================================================================');
  console.log('=== KTEA CRM: VERIFICATION OF CAREGIVER COLUMN & ASSIGNMENT SYNC ===');
  console.log('========================================================================\n');

  // 1. Baseline Integrity Check
  console.log('[STEP 1] Checking Database Baseline Integrity...');
  const initialCustomerCount = await prisma.customer.count();
  const initialCaseCount = await prisma.customerCase.count();
  const initialFollowUpCount = await prisma.followUp.count();
  const initialUserCount = await prisma.user.count();

  console.log(`- Customers: ${initialCustomerCount} (Target: 501)`);
  console.log(`- Customer Cases: ${initialCaseCount} (Target: 5)`);
  console.log(`- Follow-ups: ${initialFollowUpCount} (Target: 142)`);
  console.log(`- Users: ${initialUserCount}`);

  assert.strictEqual(initialCustomerCount, 501, 'Customer count must be preserved at 501');
  assert.strictEqual(initialCaseCount, 5, 'Cases must be preserved at 5');
  assert.ok(initialFollowUpCount >= 142, 'Follow-ups must be preserved');

  // 2. Start Test HTTP Server
  console.log('\n[STEP 2] Launching Test Server for API Verification...');
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`- Server listening at ${baseUrl}`);

  async function api(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      cookie?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ status: number; body: any }> {
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
            resolve({
              status: res.statusCode || 500,
              body: parsed,
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

  // 3. Authenticate Admin and Partner
  console.log('\n[STEP 3] Authenticating Admin & Partner...');
  const adminUser = await prisma.user.findFirst({
    where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
  });
  assert.ok(adminUser, 'Active Admin must exist');

  const partnerUser = await prisma.user.findFirst({
    where: { role: Role.PARTNER, status: UserStatus.ACTIVE },
  });
  assert.ok(partnerUser, 'Active Partner must exist');

  // Generate session cookies directly or via login
  // Using direct session simulation via login or service query
  // Let's test customerService.getCustomers directly first
  console.log('\n[STEP 4] Testing customerService.getCustomers with assigned caregivers...');
  const res = await customerService.getCustomers({ page: 1, pageSize: 20 });
  assert.ok(res.items.length > 0, 'Must return customers');

  // Find a customer with assignment
  const assignedCustomer = res.items.find((c: any) => c.assignedCaregivers && c.assignedCaregivers.length > 0);
  assert.ok(assignedCustomer, 'At least one customer must have an assigned caregiver');
  console.log(`- Found customer with caregiver: ID=${assignedCustomer.id}, Name="${assignedCustomer.fullName}"`);
  console.log(`  * assignedCaregiverName: "${assignedCustomer.assignedCaregiverName}"`);
  console.log(`  * assignedCaregivers:`, assignedCustomer.assignedCaregivers);
  assert.notStrictEqual(assignedCustomer.assignedCaregiverName, 'Chưa phân công', 'Assigned customer must have real caregiver name');
  assert.strictEqual(typeof assignedCustomer.assignedCaregiverName, 'string', 'Caregiver name must be a string');
  assert.ok(assignedCustomer.assignedCaregivers[0].fullName, 'Caregiver object must have fullName');

  // Find an unassigned customer
  const unassignedCustomer = res.items.find((c: any) => !c.assignedCaregivers || c.assignedCaregivers.length === 0);
  assert.ok(unassignedCustomer, 'At least one customer must be unassigned');
  console.log(`\n- Found unassigned customer: ID=${unassignedCustomer.id}, Name="${unassignedCustomer.fullName}"`);
  console.log(`  * assignedCaregiverName: "${unassignedCustomer.assignedCaregiverName}"`);
  assert.strictEqual(unassignedCustomer.assignedCaregiverName, 'Chưa phân công', 'Unassigned customer must show "Chưa phân công"');
  assert.strictEqual(unassignedCustomer.assignedCaregivers.length, 0, 'Unassigned customer must have empty assignedCaregivers array');

  // 5. Test Multiple Caregivers
  console.log('\n[STEP 5] Testing multiple caregivers support on a single customer...');
  // Find a customer with exactly 1 assignment
  const singleAssigned = await prisma.customerAssignment.findFirst({
    include: { customer: true, user: true },
  });
  assert.ok(singleAssigned, 'Single assignment must exist');

  // Find another active user
  const otherUser = await prisma.user.findFirst({
    where: {
      status: UserStatus.ACTIVE,
      id: { not: singleAssigned.userId },
    },
  });
  assert.ok(otherUser, 'A second active user must exist');

  // Temporarily add a second assignment to test multi-caregiver
  const tempAssignmentId = 'temp-multi-caregiver-test';
  await prisma.customerAssignment.create({
    data: {
      id: tempAssignmentId,
      customerId: singleAssigned.customerId,
      userId: otherUser.id,
      notes: 'TEST_MULTI_CAREGIVER',
    },
  });

  try {
    const multiRes = await customerService.getCustomerById(singleAssigned.customerId);
    console.log(`- Customer ID=${multiRes.id} with multiple caregivers:`);
    console.log(`  * assignedCaregiverName: "${multiRes.assignedCaregiverName}"`);
    console.log(`  * Count of assigned caregivers: ${multiRes.assignedCaregivers.length}`);

    assert.strictEqual(multiRes.assignedCaregivers.length, 2, 'Must have exactly 2 caregivers');
    assert.ok(multiRes.assignedCaregiverName.includes(singleAssigned.user.fullName), 'Must contain first caregiver name');
    assert.ok(multiRes.assignedCaregiverName.includes(otherUser.fullName), 'Must contain second caregiver name');
    assert.ok(multiRes.assignedCaregiverName.includes(', '), 'Names must be joined by comma');
    console.log('✓ TEST 5 PASSED: Multiple caregivers are properly aggregated and displayed.');
  } finally {
    // Clean up temporary assignment
    await prisma.customerAssignment.deleteMany({
      where: { id: tempAssignmentId },
    });
  }

  // 6. Test Caregiver Name Updates Upon Reassignment & Unassign
  console.log('\n[STEP 6] Testing Assignment & Unassignment Synchronization...');
  const testTargetCust = unassignedCustomer;
  // Assign target customer to partnerUser
  await userService.assignCustomers(
    { id: adminUser.id, email: adminUser.email },
    partnerUser.id,
    [testTargetCust.id],
    'Test assignment synchronization'
  );

  try {
    // Check customer now has partnerUser as caregiver
    const afterAssign = await customerService.getCustomerById(testTargetCust.id);
    console.log(`- After assigning to ${partnerUser.fullName}:`);
    console.log(`  * assignedCaregiverName: "${afterAssign.assignedCaregiverName}"`);
    assert.strictEqual(afterAssign.assignedCaregiverName, partnerUser.fullName, 'Caregiver name must update immediately to partner');
    assert.strictEqual(afterAssign.assignedCaregivers.length, 1, 'Caregivers count must be 1');

    // Unassign customer
    await userService.unassignCustomer(
      { id: adminUser.id, email: adminUser.email },
      partnerUser.id,
      testTargetCust.id,
      { sourceType: 'ALL' }
    );

    // Check customer is now "Chưa phân công"
    const afterUnassign = await customerService.getCustomerById(testTargetCust.id);
    console.log(`- After unassigning:`);
    console.log(`  * assignedCaregiverName: "${afterUnassign.assignedCaregiverName}"`);
    assert.strictEqual(afterUnassign.assignedCaregiverName, 'Chưa phân công', 'Caregiver name must revert to "Chưa phân công"');
    assert.strictEqual(afterUnassign.assignedCaregivers.length, 0, 'Caregivers count must be 0');
    console.log('✓ TEST 6 PASSED: Assign and Unassign immediately update caregiver data without cache lag.');
  } finally {
    // Ensure clean state for testTargetCust
    await prisma.customerAssignmentGrant.deleteMany({
      where: { customerId: testTargetCust.id, userId: partnerUser.id },
    }).catch(() => {});
    await prisma.customerAssignment.deleteMany({
      where: { customerId: testTargetCust.id, userId: partnerUser.id },
    }).catch(() => {});
  }

  // 7. Verify RBAC scoping for Partner vs Admin
  console.log('\n[STEP 7] Verifying RBAC scoping in Customer Listing...');
  const partnerScopedRes = await customerService.getCustomers({
    page: 1,
    pageSize: 10,
    scopedCustomerIds: [assignedCustomer.id],
  });
  assert.strictEqual(partnerScopedRes.pagination.total, 1, 'Partner scoped query must return strictly scoped total');
  assert.strictEqual(partnerScopedRes.items[0].id, assignedCustomer.id, 'Partner scoped customer must match assigned customer');
  assert.strictEqual(partnerScopedRes.items[0].assignedCaregiverName, assignedCustomer.assignedCaregiverName, 'Caregiver name must be preserved in partner scope');
  console.log('✓ TEST 7 PASSED: Scoped RBAC queries preserve caregiver information correctly.');

  // 8. Close Server & Verify Final DB Baseline
  server.close();

  console.log('\n[STEP 8] Final Database Integrity Verification...');
  const finalCustCount = await prisma.customer.count();
  const finalCaseCount = await prisma.customerCase.count();
  const finalFollowUpCount = await prisma.followUp.count();
  const finalUserCount = await prisma.user.count();

  console.log(`- Final Customers: ${finalCustCount} (Preserved: 501)`);
  console.log(`- Final Cases: ${finalCaseCount} (Preserved: 5)`);
  console.log(`- Final Follow-ups: ${finalFollowUpCount} (Preserved: 142)`);
  console.log(`- Final Users: ${finalUserCount} (Preserved: ${initialUserCount})`);

  assert.strictEqual(finalCustCount, 501, 'Customer count must remain exactly 501');
  assert.strictEqual(finalCaseCount, 5, 'Cases count must remain exactly 5');
  assert.strictEqual(finalFollowUpCount, initialFollowUpCount, 'Follow-up count must remain untouched');
  assert.strictEqual(finalUserCount, initialUserCount, 'Users count must remain untouched');

  console.log('\n========================================================================');
  console.log('=== ALL CAREGIVER COLUMN VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runVerification().catch((err) => {
  console.error('\n[VERIFICATION FAILED]:', err);
  process.exit(1);
});

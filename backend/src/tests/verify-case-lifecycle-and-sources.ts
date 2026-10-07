import prisma from '../config/database.js';
import { caseService } from '../services/case.service.js';
import { customerService } from '../services/customer.service.js';
import { customerSourceService } from '../services/customerSource.service.js';
import { customerSourceRepository } from '../repositories/customerSource.repository.js';
import { analyticsService } from '../services/analytics.service.js';
import { productRepository } from '../repositories/product.repository.js';
import { CaseProgress, CaseStatus } from '@prisma/client';
import { BadRequestError } from '../utils/errors.js';

async function runCaseLifecycleAndSourcesVerification() {
  console.log('🧪 Starting Case Lifecycle & Customer Source Verification Suite (26 Tests)...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  const TEST_PHONE_1 = '0999000111';
  const TEST_PHONE_2 = '0999000222';
  const TEST_PRODUCT_CODE = 'TEST_LOAN_PROD';
  let testCustomerId: string | null = null;
  let testCustomer2Id: string | null = null;
  let testProductId: string | null = null;
  let testSourceId: string | null = null;
  let case1Id: string | null = null;
  let case2Id: string | null = null;
  let case3Id: string | null = null;

  try {
    // PREPARATION: Clean up any prior test records if present
    await prisma.customerCase.deleteMany({
      where: {
        customer: {
          phone: { in: [TEST_PHONE_1, TEST_PHONE_2] },
        },
      },
    });
    await prisma.customerActivity.deleteMany({
      where: {
        customer: {
          phone: { in: [TEST_PHONE_1, TEST_PHONE_2] },
        },
      },
    });
    await prisma.customer.deleteMany({
      where: { phone: { in: [TEST_PHONE_1, TEST_PHONE_2] } },
    });
    await prisma.product.deleteMany({
      where: { code: TEST_PRODUCT_CODE },
    });
    await prisma.customerSource.deleteMany({
      where: { name: { in: ['TEST_PARTNER_SOURCE', 'TEST_INACTIVE_SOURCE'] } },
    });

    // Ensure a test product exists
    let testProduct = await prisma.product.findUnique({ where: { code: TEST_PRODUCT_CODE } });
    if (!testProduct) {
      testProduct = await prisma.product.create({
        data: {
          code: TEST_PRODUCT_CODE,
          name: 'Test Consumer Loan',
          description: 'Product for lifecycle test',
          active: true,
        },
      });
    }
    testProductId = testProduct.id;

    console.log('--- PHASE 1: CUSTOMER & CASE CREATION TESTS (1 - 5) ---');

    // Test 1: Create customer
    const customer = await customerService.createCustomer({
      fullName: 'Lifecycle Test Customer',
      phone: TEST_PHONE_1,
      source: 'KTEA',
    });
    testCustomerId = customer.id;
    assert(customer && customer.id.length > 0, '1. Create customer');

    // Test 2: Create case without product
    const caseWithoutProduct = await caseService.createCase(customer.id, {
      productId: null,
    });
    case1Id = caseWithoutProduct.id;
    assert(
      caseWithoutProduct &&
        caseWithoutProduct.productId === null &&
        caseWithoutProduct.progress === CaseProgress.NOT_SELECTED &&
        caseWithoutProduct.caseStatus === CaseStatus.ACTIVE,
      '2. Create case without product (productId is null, progress=NOT_SELECTED, status=ACTIVE)'
    );

    // Test 3: Create case with product
    const caseWithProduct = await caseService.createCase(customer.id, {
      productId: testProductId,
    });
    case2Id = caseWithProduct.id;
    assert(
      caseWithProduct &&
        caseWithProduct.productId === testProductId &&
        caseWithProduct.progress === CaseProgress.REGISTRATION_CREATED,
      '3. Create case with product (productId set, progress=REGISTRATION_CREATED)'
    );

    // Test 4: Customer can have multiple cases
    const customerCases = await caseService.getCasesByCustomerId(customer.id);
    assert(customerCases.length >= 2, `4. Customer can have multiple cases (Actual: ${customerCases.length})`);

    // Test 5: Case progress starts at NOT_SELECTED
    assert(
      caseWithoutProduct.progress === CaseProgress.NOT_SELECTED,
      '5. Case progress starts at NOT_SELECTED for unselected product'
    );

    console.log('\n--- PHASE 2: PROGRESS TRANSITION FLOW TESTS (6 - 12) ---');

    // Test 6: NOT_SELECTED -> REGISTRATION_CREATED
    const updatedCase1WithProduct = await caseService.selectProduct(case1Id, {
      productId: testProductId,
    });
    assert(
      updatedCase1WithProduct.productId === testProductId &&
        updatedCase1WithProduct.progress === CaseProgress.REGISTRATION_CREATED,
      '6. NOT_SELECTED -> REGISTRATION_CREATED (via selectProduct)'
    );

    // Test 7: REGISTRATION_CREATED -> REGISTRATION_COMPLETED
    const step7 = await caseService.updateProgress(case1Id, {
      toProgress: CaseProgress.REGISTRATION_COMPLETED,
    });
    assert(step7.progress === CaseProgress.REGISTRATION_COMPLETED, '7. REGISTRATION_CREATED -> REGISTRATION_COMPLETED');

    // Test 8: REGISTRATION_COMPLETED -> UNDER_REVIEW
    const step8 = await caseService.updateProgress(case1Id, {
      toProgress: CaseProgress.UNDER_REVIEW,
    });
    assert(step8.progress === CaseProgress.UNDER_REVIEW, '8. REGISTRATION_COMPLETED -> UNDER_REVIEW');

    // Test 9: UNDER_REVIEW -> APPROVED
    const step9 = await caseService.updateProgress(case1Id, {
      toProgress: CaseProgress.APPROVED,
    });
    assert(
      step9.progress === CaseProgress.APPROVED && step9.caseStatus === CaseStatus.APPROVED,
      '9. UNDER_REVIEW -> APPROVED (status=APPROVED, progress=APPROVED)'
    );

    // Test 10: APPROVED -> CARD_ISSUED
    const step10 = await caseService.updateProgress(case1Id, {
      toProgress: CaseProgress.CARD_ISSUED,
    });
    assert(step10.progress === CaseProgress.CARD_ISSUED, '10. APPROVED -> CARD_ISSUED');

    // Test 11: CARD_ISSUED -> CARD_ACTIVATED
    const step11 = await caseService.updateProgress(case1Id, {
      toProgress: CaseProgress.CARD_ACTIVATED,
    });
    assert(step11.progress === CaseProgress.CARD_ACTIVATED, '11. CARD_ISSUED -> CARD_ACTIVATED');

    // Test 12: CARD_ACTIVATED -> COMPLETED
    const step12 = await caseService.updateProgress(case1Id, {
      toProgress: CaseProgress.COMPLETED,
    });
    assert(
      step12.progress === CaseProgress.COMPLETED && step12.caseStatus === CaseStatus.COMPLETED,
      '12. CARD_ACTIVATED -> COMPLETED (terminal completion)'
    );

    console.log('\n--- PHASE 3: REJECTION & TERMINAL STATE TESTS (13 - 19) ---');

    // Case 2 was created at REGISTRATION_CREATED. Move it to UNDER_REVIEW first.
    await caseService.updateProgress(case2Id, { toProgress: CaseProgress.REGISTRATION_COMPLETED });
    await caseService.updateProgress(case2Id, { toProgress: CaseProgress.UNDER_REVIEW });

    // Test 13: UNDER_REVIEW -> REJECTED
    const rejectedCase2 = await caseService.rejectCase(case2Id, {
      reason: 'Low credit score according to CIC report',
      note: 'Customer had group 2 debt in 2025',
    });
    assert(
      rejectedCase2.caseStatus === CaseStatus.REJECTED && rejectedCase2.rejectedAt !== null,
      '13. UNDER_REVIEW -> REJECTED'
    );

    // Test 14: REJECTED cannot transition
    let rejectedCannotTransition = false;
    try {
      await caseService.updateProgress(case2Id, { toProgress: CaseProgress.APPROVED });
    } catch (err) {
      if (err instanceof BadRequestError) {
        rejectedCannotTransition = true;
      }
    }
    assert(rejectedCannotTransition, '14. REJECTED cannot transition');

    // Test 15: COMPLETED cannot transition
    let completedCannotTransition = false;
    try {
      await caseService.updateProgress(case1Id, { toProgress: CaseProgress.CARD_ACTIVATED });
    } catch (err) {
      if (err instanceof BadRequestError) {
        completedCannotTransition = true;
      }
    }
    assert(completedCannotTransition, '15. COMPLETED cannot transition');

    // Test 16: New Case can be created after rejection
    const case3 = await caseService.createCase(customer.id, {
      productId: null,
    });
    case3Id = case3.id;
    assert(
      case3 &&
        case3.id !== case2Id &&
        case3.caseStatus === CaseStatus.ACTIVE &&
        case3.progress === CaseProgress.NOT_SELECTED,
      '16. New Case can be created after rejection'
    );

    // Test 17: Rejected Case remains unchanged
    const reloadedCase2 = await caseService.getCaseById(case2Id);
    assert(
      reloadedCase2.caseStatus === CaseStatus.REJECTED &&
        reloadedCase2.rejectionReason === 'Low credit score according to CIC report' &&
        reloadedCase2.rejectedAt?.toISOString() === rejectedCase2.rejectedAt?.toISOString(),
      '17. Rejected Case remains unchanged after creating new case'
    );

    // Test 18: Rejection reason is persisted
    assert(
      reloadedCase2.rejectionReason === 'Low credit score according to CIC report' &&
        reloadedCase2.rejectionNote === 'Customer had group 2 debt in 2025' &&
        reloadedCase2.failureReason === 'Low credit score according to CIC report',
      '18. Rejection reason and note are persisted'
    );

    // Test 19: Progress history is persisted
    const fullCase1 = await caseService.getCaseById(case1Id);
    const fullCase2 = await caseService.getCaseById(case2Id);
    assert(
      (fullCase1.progressHistory?.length || 0) >= 7 && (fullCase2.progressHistory?.length || 0) >= 3,
      `19. Progress history is persisted (Case 1 steps: ${fullCase1.progressHistory?.length}, Case 2 steps: ${fullCase2.progressHistory?.length})`
    );

    console.log('\n--- PHASE 4: CUSTOMER SOURCE TESTS (20 - 25) ---');

    // Test 20: Source KTEA exists
    const sourceKtea = await customerSourceRepository.findByName('KTEA');
    assert(sourceKtea !== null && sourceKtea.active === true, '20. Source KTEA exists and is active');

    // Test 21: Source VIB Times City exists (renamed from VIB)
    const sourceVib = await customerSourceRepository.findByName('VIB Times City');
    assert(sourceVib !== null && sourceVib.active === true, '21. Source VIB Times City exists and is active (renamed from VIB)');

    // Test 22: New source can be created
    const newSource = await customerSourceService.createSource({
      name: 'TEST_PARTNER_SOURCE',
      active: true,
    });
    testSourceId = newSource.id;
    assert(newSource && newSource.name === 'TEST_PARTNER_SOURCE' && newSource.active === true, '22. New source can be created');

    // Test 23: Source can be deactivated
    const deactivatedSource = await customerSourceService.deactivateSource(testSourceId);
    assert(deactivatedSource.active === false, '23. Source can be deactivated');

    // Test 24: Deactivated source cannot be selected for new customers
    let deactivatedBlocked = false;
    try {
      await customerService.createCustomer({
        fullName: 'Blocked Customer',
        phone: TEST_PHONE_2,
        sourceId: testSourceId,
      });
    } catch (err) {
      if (err instanceof BadRequestError) {
        deactivatedBlocked = true;
      }
    }
    assert(deactivatedBlocked, '24. Deactivated source cannot be selected for new customers');

    // Test 25: Existing customers retain inactive source
    // Create an active temporary source first, assign to customer, then deactivate source
    const tempSource = await customerSourceService.createSource({
      name: 'TEST_INACTIVE_SOURCE',
      active: true,
    });
    const customer2 = await customerService.createCustomer({
      fullName: 'Customer With Inactive Source',
      phone: TEST_PHONE_2,
      sourceId: tempSource.id,
    });
    testCustomer2Id = customer2.id;
    await customerSourceService.deactivateSource(tempSource.id);

    // Fetch customer detail: customer should retain source reference
    const reloadedCustomer2 = await customerService.getCustomerDetail(testCustomer2Id);
    assert(
      reloadedCustomer2.sourceId === tempSource.id &&
        (reloadedCustomer2.source === 'TEST_INACTIVE_SOURCE' || reloadedCustomer2.customerSource?.name === 'TEST_INACTIVE_SOURCE'),
      '25. Existing customers retain inactive source after deactivation'
    );

    console.log('\n--- PHASE 5: ANALYTICS FOUNDATION TESTS (26) ---');

    // Test 26: Analytics distinguishes customers and cases
    const foundationMetrics = await analyticsService.getLifecycleFoundation();
    assert(
      typeof foundationMetrics.totalCustomers === 'number' &&
        typeof foundationMetrics.totalCases === 'number' &&
        Array.isArray(foundationMetrics.casesByStatus) &&
        Array.isArray(foundationMetrics.casesByProgress) &&
        Array.isArray(foundationMetrics.casesBySource) &&
        Array.isArray(foundationMetrics.customersBySource),
      `26. Analytics distinguishes customers and cases (Total Customers: ${foundationMetrics.totalCustomers}, Total Cases: ${foundationMetrics.totalCases})`
    );

  } catch (error) {
    console.error('💥 Unexpected exception during verification:', error);
    failed++;
  } finally {
    // TEARDOWN: Clean up test fixtures created during the test run
    console.log('\n--- TEARDOWN CLEANUP ---');
    try {
      if (case1Id || case2Id || case3Id) {
        await prisma.caseProgressHistory.deleteMany({
          where: { caseId: { in: [case1Id || '', case2Id || '', case3Id || ''] } },
        });
        await prisma.customerCase.deleteMany({
          where: { id: { in: [case1Id || '', case2Id || '', case3Id || ''] } },
        });
      }
      if (testCustomerId || testCustomer2Id) {
        await prisma.customerActivity.deleteMany({
          where: { customerId: { in: [testCustomerId || '', testCustomer2Id || ''] } },
        });
        await prisma.customer.deleteMany({
          where: { id: { in: [testCustomerId || '', testCustomer2Id || ''] } },
        });
      }
      if (testSourceId) {
        await prisma.customerSource.deleteMany({
          where: { id: testSourceId },
        });
      }
      await prisma.customerSource.deleteMany({
        where: { name: 'TEST_INACTIVE_SOURCE' },
      });
      if (testProductId) {
        await prisma.product.deleteMany({
          where: { id: testProductId },
        });
      }
      console.log('✓ Test fixtures successfully cleaned up.');
    } catch (cleanupErr) {
      console.warn('Warning during cleanup:', cleanupErr);
    }
    await prisma.$disconnect();
  }

  console.log(`\n==================================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCaseLifecycleAndSourcesVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

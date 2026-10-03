import prisma from '../config/database.js';
import { checkDatabaseHealth } from '../utils/db.js';

async function runDomainVerification() {
  console.log('🧪 Running Domain Model & Database Verification Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Database Ping Test
    const health = await checkDatabaseHealth();
    assert(health.connected === true, 'Database ping and connection health check');

    // 2. Customer Count Test (>= 30 customers required)
    const customerCount = await prisma.customer.count();
    assert(customerCount >= 30, `Customer count >= 30 (Actual: ${customerCount})`);

    // 3. Product Catalog Test (>= 3 products required)
    const productCount = await prisma.product.count();
    assert(productCount >= 3, `Product catalog count >= 3 (Actual: ${productCount})`);

    // 4. Distinct Customer vs Application / Case Lifecycle Test
    // Customer 01 should have a REJECTED credit card case AND an APPROVED loan case
    const customer01 = await prisma.customer.findFirst({
      where: { phone: '0901000001' },
      include: {
        cases: {
          include: { product: true },
        },
      },
    });

    assert(customer01 !== null, 'Customer 01 found by phone index');
    assert(
      (customer01?.cases.length || 0) >= 2,
      `Customer 01 has multiple cases (Actual: ${customer01?.cases.length})`
    );

    const hasRejectedCase = customer01?.cases.some((c) => c.caseStatus === 'REJECTED');
    const hasApprovedCase = customer01?.cases.some((c) => c.caseStatus === 'APPROVED');
    assert(
      Boolean(hasRejectedCase && hasApprovedCase),
      'Customer 01 exhibits real multi-application lifecycle (has REJECTED case and later APPROVED case)'
    );

    // 5. Conceptual Distinction: Recommendation != Push
    const recommendations = await prisma.recommendation.findMany({ take: 5 });
    const pushes = await prisma.pushRecord.findMany({ take: 5 });
    assert(recommendations.length > 0, `Recommendations exist as system rule outputs (Count: ${recommendations.length})`);
    assert(pushes.length > 0, `PushRecords exist as operator referral actions (Count: ${pushes.length})`);

    // Verify push record has distinct status from recommendation
    const samplePush = await prisma.pushRecord.findFirst({
      where: { failureReason: { not: null } },
    });
    assert(
      samplePush !== null && samplePush.failureReason !== null,
      'Push record contains outcome feedback / failureReason tracking'
    );

    // 6. Complete 360-degree Relational Integrity Test
    const fullProfile = await prisma.customer.findFirst({
      include: {
        needs: true,
        cases: true,
        activities: true,
        notes: true,
        followUps: true,
        customerTags: { include: { tag: true } },
        recommendations: true,
        pushRecords: true,
      },
    });

    assert(fullProfile !== null, 'Customer 360 full relational graph loads without foreign key error');
    assert((fullProfile?.needs.length || 0) > 0, 'Customer has relational needs');
    assert((fullProfile?.activities.length || 0) > 0, 'Customer has relational activities');
    assert((fullProfile?.customerTags.length || 0) > 0, 'Customer has relational tags');

    console.log(`\n========================================`);
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDomainVerification();

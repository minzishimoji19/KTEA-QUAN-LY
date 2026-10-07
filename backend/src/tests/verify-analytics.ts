import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}/api/analytics`;

async function request(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  });
  const body = (await res.json()) as any;
  return { status: res.status, body };
}

async function runAnalyticsVerification() {
  console.log('🧪 Starting Descriptive Analytics Verification & Database Reconciliation Suite...\n');

  let server: http.Server | null = null;
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: unknown) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`, detail ? JSON.stringify(detail) : '');
      failed++;
    }
  }

  try {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => {
        resolve();
      });
    });

    // ==========================================
    // 1. OVERVIEW ENDPOINT RECONCILIATION
    // ==========================================
    console.log('\n--- 1. Testing GET /api/analytics/overview ---');
    const overviewRes = await request('/overview');
    assert(overviewRes.status === 200, 'GET /api/analytics/overview returns status 200');

    const overview = overviewRes.body.data;
    assert(Boolean(overview.metrics), 'Overview response includes metrics block');
    assert(Boolean(overview.definitions), 'Overview response includes definitions dictionary');

    // Reconcile with actual database counts
    const dbTotalCustomers = await prisma.customer.count();
    const dbActiveCustomers = await prisma.customer.count({ where: { overallStatus: 'DANG_TU_VAN' } });
    const dbTotalCases = await prisma.customerCase.count();
    const dbSuccessfulCases = await prisma.customerCase.count({ where: { caseStatus: 'APPROVED' } });
    const dbFailedCases = await prisma.customerCase.count({ where: { caseStatus: 'REJECTED' } });
    const dbTotalPushes = await prisma.pushRecord.count();
    const dbSuccessfulPushes = await prisma.pushRecord.count({ where: { status: 'SUCCESS' } });
    const dbFailedPushes = await prisma.pushRecord.count({ where: { status: 'FAILED' } });

    assert(
      overview.metrics.totalCustomers === dbTotalCustomers,
      `Reconcile totalCustomers: DB(${dbTotalCustomers}) === API(${overview.metrics.totalCustomers})`
    );
    assert(
      overview.metrics.activeCustomers === dbActiveCustomers,
      `Reconcile activeCustomers: DB(${dbActiveCustomers}) === API(${overview.metrics.activeCustomers})`
    );
    assert(
      overview.metrics.totalCases === dbTotalCases,
      `Reconcile totalCases: DB(${dbTotalCases}) === API(${overview.metrics.totalCases})`
    );
    assert(
      overview.metrics.successfulCases === dbSuccessfulCases,
      `Reconcile successfulCases: DB(${dbSuccessfulCases}) === API(${overview.metrics.successfulCases})`
    );
    assert(
      overview.metrics.failedCases === dbFailedCases,
      `Reconcile failedCases: DB(${dbFailedCases}) === API(${overview.metrics.failedCases})`
    );
    assert(
      overview.metrics.totalPushes === dbTotalPushes,
      `Reconcile totalPushes: DB(${dbTotalPushes}) === API(${overview.metrics.totalPushes})`
    );
    assert(
      overview.metrics.successfulPushes === dbSuccessfulPushes,
      `Reconcile successfulPushes: DB(${dbSuccessfulPushes}) === API(${overview.metrics.successfulPushes})`
    );
    assert(
      overview.metrics.failedPushes === dbFailedPushes,
      `Reconcile failedPushes: DB(${dbFailedPushes}) === API(${overview.metrics.failedPushes})`
    );

    // Verify all 15 overview metrics are present
    const expectedOverviewMetricKeys = [
      'totalCustomers',
      'newCustomersInPeriod',
      'activeCustomers',
      'customersWithActiveNeeds',
      'customersRequiringFollowUp',
      'overdueFollowUps',
      'totalCases',
      'successfulCases',
      'failedCases',
      'pendingCases',
      'pushCandidates',
      'totalPushes',
      'successfulPushes',
      'failedPushes',
    ];
    for (const key of expectedOverviewMetricKeys) {
      assert(
        typeof overview.metrics[key] === 'number',
        `Overview contains valid numeric metric: ${key} (${overview.metrics[key]})`
      );
    }

    // Verify customersByStatus breakdown
    assert(Array.isArray(overview.customersByStatus), 'Overview contains customersByStatus array');

    // ==========================================
    // 2. CUSTOMER ANALYTICS
    // ==========================================
    console.log('\n--- 2. Testing GET /api/analytics/customers ---');
    const custRes = await request('/customers');
    assert(custRes.status === 200, 'GET /api/analytics/customers returns status 200');

    const custData = custRes.body.data;
    assert(Array.isArray(custData.byStatus), 'Customer analytics has byStatus array');
    assert(Array.isArray(custData.byProduct), 'Customer analytics has byProduct array');
    assert(Array.isArray(custData.byNeed), 'Customer analytics has byNeed array');
    assert(Array.isArray(custData.bySource), 'Customer analytics has bySource array');
    assert(Array.isArray(custData.creationTrend), 'Customer analytics has creationTrend array');
    assert(custData.byStatus.length > 0, 'byStatus contains populated status categories');
    const dbProductCount = await prisma.product.count();
    if (dbProductCount > 0) {
      assert(custData.byProduct.length > 0, 'byProduct contains populated products with customer counts');
    } else {
      assert(Array.isArray(custData.byProduct), 'byProduct is a valid array when no products exist');
    }

    // ==========================================
    // 3. CASE ANALYTICS
    // ==========================================
    console.log('\n--- 3. Testing GET /api/analytics/cases ---');
    const casesRes = await request('/cases');
    assert(casesRes.status === 200, 'GET /api/analytics/cases returns status 200');

    const caseData = casesRes.body.data;
    assert(Array.isArray(caseData.byProduct), 'Case analytics has byProduct array');
    assert(Array.isArray(caseData.byStatus), 'Case analytics has byStatus array');
    assert(Boolean(caseData.successVsFailure), 'Case analytics has successVsFailure block');
    assert(Array.isArray(caseData.casesOverTime), 'Case analytics has casesOverTime array');

    const svf = caseData.successVsFailure;
    assert(
      typeof svf.approvalRateOnResolved.value === 'number' &&
        typeof svf.approvalRateOnResolved.numerator === 'number' &&
        typeof svf.approvalRateOnResolved.denominator === 'number' &&
        Boolean(svf.approvalRateOnResolved.definition),
      'Approval rate on resolved cases includes explicit value, numerator, denominator, and definition'
    );
    console.log(`    ℹ Definition: "${svf.approvalRateOnResolved.definition}"`);

    // ==========================================
    // 4. NEED ANALYTICS
    // ==========================================
    console.log('\n--- 4. Testing GET /api/analytics/needs ---');
    const needsRes = await request('/needs');
    assert(needsRes.status === 200, 'GET /api/analytics/needs returns status 200');

    const needData = needsRes.body.data;
    assert(Array.isArray(needData.mostCommonNeeds), 'Need analytics has mostCommonNeeds array');
    assert(Array.isArray(needData.activeNeeds), 'Need analytics has activeNeeds array');
    assert(Array.isArray(needData.resolvedNeeds), 'Need analytics has resolvedNeeds array');
    assert(Array.isArray(needData.needsByProduct), 'Need analytics has needsByProduct array');
    assert(Array.isArray(needData.trendOverTime), 'Need analytics has trendOverTime array');

    // Reconcile total needs with database
    const dbTotalNeeds = await prisma.customerNeed.count();
    assert(
      needData.totalNeeds === dbTotalNeeds,
      `Reconcile totalNeeds: DB(${dbTotalNeeds}) === API(${needData.totalNeeds})`
    );

    // ==========================================
    // 5. PUSH ANALYTICS
    // ==========================================
    console.log('\n--- 5. Testing GET /api/analytics/push ---');
    const pushRes = await request('/push');
    assert(pushRes.status === 200, 'GET /api/analytics/push returns status 200');

    const pushData = pushRes.body.data;
    assert(
      typeof pushData.recommendationsGenerated === 'number',
      'Push analytics includes recommendationsGenerated count'
    );
    assert(
      typeof pushData.pushesCreated === 'number',
      'Push analytics includes pushesCreated count'
    );
    assert(Array.isArray(pushData.pushesByTargetProduct), 'Push analytics has pushesByTargetProduct');
    assert(Array.isArray(pushData.resultDistribution), 'Push analytics has resultDistribution');
    assert(Boolean(pushData.pushSuccessMetrics), 'Push analytics has pushSuccessMetrics block');
    assert(Array.isArray(pushData.pushTrendOverTime), 'Push analytics has pushTrendOverTime array');

    const psm = pushData.pushSuccessMetrics;
    assert(
      typeof psm.successRateOfTerminalPushes.value === 'number' &&
        typeof psm.successRateOfTerminalPushes.numerator === 'number' &&
        typeof psm.successRateOfTerminalPushes.denominator === 'number' &&
        Boolean(psm.successRateOfTerminalPushes.definition),
      'Push success rate on terminal pushes includes explicit formula, numerator, denominator, and definition'
    );
    console.log(`    ℹ Definition: "${psm.successRateOfTerminalPushes.definition}"`);

    // ==========================================
    // 6. DATE FILTER INTEGRATION TEST
    // ==========================================
    console.log('\n--- 6. Testing Date Range Filter ---');
    const filteredRes = await request('/overview?startDate=2026-01-01&endDate=2026-12-31');
    assert(filteredRes.status === 200, 'GET /overview with valid date range returns 200');
    assert(
      filteredRes.body.data.period.startDate !== null,
      'Date filter correctly reflected in period metadata'
    );

    console.log(`\n========================================`);
    console.log(`Analytics Verification Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => (server as http.Server).close(() => resolve()));
    }
    await prisma.$disconnect();
  }
}

runAnalyticsVerification();

import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';

const PORT = 5056;
const BASE_URL = `http://localhost:${PORT}/api/dashboard`;

async function runDashboardVerification() {
  console.log('🧪 Starting Dashboard Aggregation & Operational Workspace Verification...\n');

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

    const res = await fetch(BASE_URL, {
      headers: { Accept: 'application/json' },
    });
    const json = (await res.json()) as any;

    assert(res.status === 200, 'GET /api/dashboard returns status 200');
    assert(json.success === true, 'Response contains success: true');

    const data = json.data;
    assert(Boolean(data), 'Response data object is present');

    // 1. Overview counts
    assert(typeof data.overview?.totalCustomers === 'number', 'overview.totalCustomers is number');
    assert(typeof data.overview?.activeCustomers === 'number', 'overview.activeCustomers is number');
    assert(typeof data.overview?.openCases === 'number', 'overview.openCases is number');
    assert(typeof data.overview?.pendingPushes === 'number', 'overview.pendingPushes is number');
    assert(typeof data.overview?.overdueFollowUpsCount === 'number', 'overview.overdueFollowUpsCount is number');
    assert(typeof data.overview?.todayFollowUpsCount === 'number', 'overview.todayFollowUpsCount is number');
    assert(typeof data.overview?.newRecommendationsCount === 'number', 'overview.newRecommendationsCount is number');

    console.log('\n--- Overview Counts ---');
    console.log(`  Total Customers: ${data.overview.totalCustomers}`);
    console.log(`  Active Customers: ${data.overview.activeCustomers}`);
    console.log(`  Open Cases: ${data.overview.openCases}`);
    console.log(`  Pending Pushes: ${data.overview.pendingPushes}`);
    console.log(`  Overdue Follow-ups: ${data.overview.overdueFollowUpsCount}`);
    console.log(`  Today Follow-ups: ${data.overview.todayFollowUpsCount}`);
    console.log(`  New Recommendations: ${data.overview.newRecommendationsCount}`);

    // 2. Critical Today
    assert(Array.isArray(data.criticalToday?.overdueFollowUps), 'criticalToday.overdueFollowUps is array');
    assert(Array.isArray(data.criticalToday?.todayFollowUps), 'criticalToday.todayFollowUps is array');
    console.log(`  Overdue Follow-ups list count: ${data.criticalToday.overdueFollowUps.length}`);
    console.log(`  Today's Follow-ups list count: ${data.criticalToday.todayFollowUps.length}`);

    // 3. High-potential Customers
    assert(Array.isArray(data.highPotentialCustomers), 'highPotentialCustomers is array');
    console.log(`  High-potential customers count: ${data.highPotentialCustomers.length}`);

    // 4. New Recommendations
    assert(Array.isArray(data.newRecommendations), 'newRecommendations is array');
    console.log(`  New recommendations count: ${data.newRecommendations.length}`);

    // 5. Recent Activities
    assert(Array.isArray(data.recentActivities), 'recentActivities is array');
    console.log(`  Recent activities count: ${data.recentActivities.length}`);

    // Reconcile with Database directly
    const dbTotalCustomers = await prisma.customer.count();
    const dbActiveCustomers = await prisma.customer.count({ where: { overallStatus: 'ACTIVE' } });
    assert(data.overview.totalCustomers === dbTotalCustomers, `Reconcile totalCustomers: DB(${dbTotalCustomers}) === API(${data.overview.totalCustomers})`);
    assert(data.overview.activeCustomers === dbActiveCustomers, `Reconcile activeCustomers: DB(${dbActiveCustomers}) === API(${data.overview.activeCustomers})`);

    console.log(`\n========================================`);
    console.log(`Dashboard Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => {
        (server as http.Server).close(() => resolve());
      });
    }
    await prisma.$disconnect();
  }
}

runDashboardVerification();

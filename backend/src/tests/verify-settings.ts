import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';

const PORT = 5057;
const BASE_URL = `http://localhost:${PORT}/api`;

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  const body = (await res.json()) as any;
  return { status: res.status, body };
}

async function runSettingsVerification() {
  console.log('🧪 Starting Settings & Data Governance Verification Suite...\n');

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

    // 1. GET /api/settings
    console.log('--- 1. Testing GET /api/settings ---');
    const getRes = await request('/settings');
    assert(getRes.status === 200, 'GET /api/settings returns 200');
    const settings = getRes.body.data;
    assert(Boolean(settings.general?.appName), 'Settings contains general.appName');
    assert(typeof settings.general?.defaultPageSize === 'number', 'Settings contains general.defaultPageSize');
    assert(Array.isArray(settings.needCategories), 'Settings contains needCategories array');
    assert(Array.isArray(settings.statuses), 'Settings contains statuses array');
    assert(Boolean(settings.recommendationSettings?.rules?.ruleA), 'Settings contains recommendation rule configs');

    // 2. PATCH /api/settings/general
    console.log('\n--- 2. Testing PATCH /api/settings/general ---');
    const patchGeneralRes = await request('/settings/general', {
      method: 'PATCH',
      body: JSON.stringify({
        appName: 'K-TEA Financial Intelligence CRM',
        defaultPageSize: 20,
        dateFormat: 'DD/MM/YYYY',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    });
    assert(patchGeneralRes.status === 200, 'PATCH /api/settings/general returns 200');
    assert(
      patchGeneralRes.body.data.general.appName === 'K-TEA Financial Intelligence CRM',
      'appName updated successfully'
    );
    assert(
      patchGeneralRes.body.data.general.defaultPageSize === 20,
      'defaultPageSize updated to 20'
    );

    // 3. PATCH /api/settings/needs
    console.log('\n--- 3. Testing PATCH /api/settings/needs ---');
    const currentNeeds = patchGeneralRes.body.data.needCategories;
    const updatedNeeds = [
      ...currentNeeds,
      {
        code: 'EQUIPMENT_LEASING',
        label: 'Equipment Leasing',
        description: 'Commercial equipment acquisition and lease financing',
        active: true,
      },
    ];
    const patchNeedsRes = await request('/settings/needs', {
      method: 'PATCH',
      body: JSON.stringify(updatedNeeds),
    });
    assert(patchNeedsRes.status === 200, 'PATCH /api/settings/needs returns 200');
    assert(
      patchNeedsRes.body.data.needCategories.some((c: any) => c.code === 'EQUIPMENT_LEASING'),
      'New need category added and persisted'
    );

    // 4. PATCH /api/settings/recommendations (Rule tuning & separation of config from logic)
    console.log('\n--- 4. Testing PATCH /api/settings/recommendations ---');
    const patchRecsRes = await request('/settings/recommendations', {
      method: 'PATCH',
      body: JSON.stringify({
        minScoreThreshold: 65,
        highPotentialThreshold: 80,
        rules: {
          ruleA: {
            id: 'RULE_A_ACTIVE_LOAN_NEED',
            name: 'Active Loan Need Match',
            enabled: true,
            baseScore: 72, // Tuned base score
            description: 'Custom tuned loan rule',
          },
        },
      }),
    });
    assert(patchRecsRes.status === 200, 'PATCH /api/settings/recommendations returns 200');
    assert(
      patchRecsRes.body.data.recommendationSettings.minScoreThreshold === 65,
      'minScoreThreshold updated to 65'
    );
    assert(
      patchRecsRes.body.data.recommendationSettings.rules.ruleA.baseScore === 72,
      'ruleA baseScore updated to 72'
    );

    // 5. GET /api/data/status
    console.log('\n--- 5. Testing GET /api/data/status ---');
    const dataStatusRes = await request('/data/status');
    assert(dataStatusRes.status === 200, 'GET /api/data/status returns 200');
    const dataStatus = dataStatusRes.body.data;
    assert(dataStatus.database.status === 'HEALTHY', 'Database health is HEALTHY');
    assert(typeof dataStatus.database.pingLatencyMs === 'number', 'Database ping latency measured');
    assert(typeof dataStatus.database.tables.customers === 'number', 'Database table counts populated');
    assert(typeof dataStatus.demoMode.isDemoMode === 'boolean', 'Demo mode indicator present');
    assert(Boolean(dataStatus.backupGuidance.logicalBackup.command), 'Backup guidance command provided');

    // 6. GET /api/data/export
    console.log('\n--- 6. Testing GET /api/data/export ---');
    const exportRes = await request('/data/export');
    assert(exportRes.status === 200, 'GET /api/data/export returns 200');
    const exportBundle = exportRes.body.data;
    assert(Boolean(exportBundle.metadata?.exportedAt), 'Export bundle contains metadata timestamp');
    assert(Array.isArray(exportBundle.data?.customers), 'Export bundle contains customers array');
    assert(Array.isArray(exportBundle.data?.products), 'Export bundle contains products array');
    assert(Boolean(exportBundle.settings), 'Export bundle contains system settings');

    console.log(`\n========================================`);
    console.log(`Settings & Data Governance Results: ${passed} Passed, ${failed} Failed`);
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

runSettingsVerification();

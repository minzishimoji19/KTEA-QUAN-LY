import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';

const PORT = 5059;
const BASE_URL = `http://localhost:${PORT}/api`;

interface ApiResponsePayload {
  success: boolean;
  data?: any;
  pagination?: any;
  error?: any;
  message?: string;
}

async function request(path: string, options: RequestInit = {}): Promise<{ status: number; body: ApiResponsePayload }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  });

  const data = (await res.json()) as ApiResponsePayload;
  return { status: res.status, body: data };
}

async function runApiVerification() {
  console.log('🧪 Starting Full REST API Endpoint Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetail?: unknown) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`, errorDetail ? JSON.stringify(errorDetail) : '');
      failed++;
    }
  }

  let server: http.Server | null = null;
  try {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => resolve());
    });

    // 1. Health Endpoint
    const health = await request('/health');
    assert(health.status === 200 && health.body.data.status === 'healthy', 'GET /api/health returns healthy with DB stats');

    // 2. Customers List & Filter
    const custs = await request('/customers?page=1&pageSize=10');
    assert(custs.status === 200 && custs.body.data.length === 10, 'GET /api/customers pagination limit=10');
    assert(custs.body.pagination.total >= 30, `Pagination meta returned total >= 30 (Actual: ${custs.body.pagination.total})`);

    // Search filter
    const sampleSearch = custs.body.data[0]?.fullName ? custs.body.data[0].fullName.slice(0, 4) : 'Nguyen';
    const search = await request(`/customers?search=${encodeURIComponent(sampleSearch)}`);
    assert(search.status === 200 && search.body.data.length >= 1, `GET /api/customers?search=${sampleSearch}`);

    // Status filter
    const statusFilter = await request('/customers?status=DANG_TU_VAN');
    assert(statusFilter.status === 200 && statusFilter.body.data.every((c: { overallStatus: string }) => c.overallStatus === 'DANG_TU_VAN'), 'GET /api/customers?status=DANG_TU_VAN');

    // Tag filter
    const tagFilter = await request('/customers?tag=VIP_AFFLUENT');
    assert(tagFilter.status === 200, 'GET /api/customers?tag=VIP_AFFLUENT filter execution');

    // Clean up any stale test customer from previous runs
    await prisma.customer.deleteMany({ where: { phone: '0909999888' } });

    // 3. Customer Create, Read Detail, Update
    const newCust = await request('/customers', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Le Test Suite API',
        phone: '0909999888',
        email: 'api.test@synthetic.vn',
        gender: 'MALE',
        dateOfBirth: '1995-05-15',
        source: 'API_TEST',
        overallStatus: 'DANG_TIEP_CAN',
        priority: 'THANH_KHOAN',
      }),
    });
    assert(newCust.status === 201 && newCust.body.data.phone === '0909999888', 'POST /api/customers creates customer');
    const createdId = newCust.body.data.id;

    // Customer Detail 360
    const detail = await request(`/customers/${createdId}`);
    assert(detail.status === 200 && Array.isArray(detail.body.data.activities), 'GET /api/customers/:id returns 360 profile graph');
    assert(detail.body.data.activities.length >= 1, 'Initial lifecycle activity was auto-generated upon customer creation');

    // Customer Update
    const updateCust = await request(`/customers/${createdId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        overallStatus: 'DANG_TU_VAN',
        priority: 'TIN_DUNG',
      }),
    });
    assert(updateCust.status === 200 && updateCust.body.data.overallStatus === 'DANG_TU_VAN', 'PATCH /api/customers/:id updates status & priority');

    // 4. Products List
    let prods = await request('/products');
    let sampleProductId: string;
    if (!prods.body.data || prods.body.data.length === 0) {
      const createdProd = await prisma.product.create({
        data: {
          code: 'API_VERIFY_PROD',
          name: 'API Verify Product',
          description: 'Auto-created product for verification',
          active: true,
        },
      });
      sampleProductId = createdProd.id;
      prods = await request('/products');
    } else {
      sampleProductId = prods.body.data[0].id;
    }
    assert(prods.status === 200 && prods.body.data.length >= 1, 'GET /api/products returns catalog');

    // 5. Customer Cases: Create, List, Update, Delete
    const newCase = await request(`/customers/${createdId}/cases`, {
      method: 'POST',
      body: JSON.stringify({
        productId: sampleProductId,
        caseStatus: 'DRAFT',
        notes: 'Initial credit inquiry created via automated test.',
      }),
    });
    assert(newCase.status === 201 && newCase.body.data.customerId === createdId, 'POST /api/customers/:id/cases creates application case');
    const caseId = newCase.body.data.id;

    const listCases = await request(`/customers/${createdId}/cases`);
    assert(listCases.status === 200 && listCases.body.data.length === 1, 'GET /api/customers/:id/cases lists cases');

    const updateCase = await request(`/cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        caseStatus: 'UNDER_REVIEW',
        notes: 'Underwriting started.',
      }),
    });
    assert(updateCase.status === 200 && updateCase.body.data.caseStatus === 'UNDER_REVIEW', 'PATCH /api/cases/:id transitions case status');

    // 6. Customer Needs: Create, List, Update, Delete
    const newNeed = await request(`/customers/${createdId}/needs`, {
      method: 'POST',
      body: JSON.stringify({
        needType: 'INVESTMENT_GROWTH',
        status: 'OPEN',
        notes: 'Customer interested in term deposits.',
      }),
    });
    assert(newNeed.status === 201 && newNeed.body.data.needType === 'INVESTMENT_GROWTH', 'POST /api/customers/:id/needs logs need');
    const needId = newNeed.body.data.id;

    const updateNeed = await request(`/needs/${needId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    assert(updateNeed.status === 200 && updateNeed.body.data.status === 'IN_PROGRESS', 'PATCH /api/needs/:id updates need');

    // 7. Customer Activities: Create & List
    const newAct = await request(`/customers/${createdId}/activities`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'CALL',
        title: 'Discovery Outreach',
        description: 'Discussed investment goals and risk profile.',
      }),
    });
    assert(newAct.status === 201 && newAct.body.data.type === 'CALL', 'POST /api/customers/:id/activities creates activity');

    const listActs = await request(`/customers/${createdId}/activities`);
    assert(listActs.status === 200 && listActs.body.data.length >= 3, 'GET /api/customers/:id/activities returns timeline');

    // 8. Customer Notes: Create, Update, Delete
    const newNote = await request(`/customers/${createdId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content: 'Test qualitative feedback note.' }),
    });
    assert(newNote.status === 201 && newNote.body.data.content.includes('qualitative'), 'POST /api/customers/:id/notes creates note');
    const noteId = newNote.body.data.id;

    const updateNote = await request(`/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Updated note content.' }),
    });
    assert(updateNote.status === 200 && updateNote.body.data.content === 'Updated note content.', 'PATCH /api/notes/:id updates note');

    // 9. Tags & Customer Tags
    const tags = await request('/tags');
    assert(tags.status === 200 && tags.body.data.length >= 1, 'GET /api/tags returns tags');
    const sampleTagId = tags.body.data[0].id;

    const addTag = await request(`/customers/${createdId}/tags/${sampleTagId}`, { method: 'POST' });
    assert(addTag.status === 201, 'POST /api/customers/:id/tags/:tagId attaches tag');

    const removeTag = await request(`/customers/${createdId}/tags/${sampleTagId}`, { method: 'DELETE' });
    assert(removeTag.status === 200, 'DELETE /api/customers/:id/tags/:tagId detaches tag');

    // 10. Follow-ups
    const listFollowUps = await request('/follow-ups?filter=today');
    assert(listFollowUps.status === 200 && Array.isArray(listFollowUps.body.data), 'GET /api/follow-ups?filter=today');

    const newFollowUp = await request('/follow-ups', {
      method: 'POST',
      body: JSON.stringify({
        customerId: createdId,
        title: 'Review loan underwriting docs',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'PENDING',
      }),
    });
    assert(newFollowUp.status === 201 && newFollowUp.body.data.title.includes('Review loan'), 'POST /api/follow-ups creates task');
    const followUpId = newFollowUp.body.data.id;

    const updateFollowUp = await request(`/follow-ups/${followUpId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(updateFollowUp.status === 200 && updateFollowUp.body.data.status === 'COMPLETED' && updateFollowUp.body.data.completedAt !== null, 'PATCH /api/follow-ups/:id marks COMPLETED and sets completedAt');

    // 11. Push Records
    const listPushes = await request('/push-records');
    assert(listPushes.status === 200 && Array.isArray(listPushes.body.data), 'GET /api/push-records lists dispatches');

    const newPush = await request(`/customers/${createdId}/push-records`, {
      method: 'POST',
      body: JSON.stringify({
        targetProductId: sampleProductId,
        status: 'PENDING',
        note: 'Customer referred to Wealth Advisor via test suite.',
      }),
    });
    assert(newPush.status === 201 && newPush.body.data.status === 'PENDING', 'POST /api/customers/:id/push-records dispatches referral');
    const pushId = newPush.body.data.id;

    const updatePush = await request(`/push-records/${pushId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'SUCCESS',
        note: 'Customer successfully opened wealth account.',
      }),
    });
    assert(updatePush.status === 200 && updatePush.body.data.status === 'SUCCESS' && updatePush.body.data.resultAt !== null, 'PATCH /api/push-records/:id updates terminal outcome and sets resultAt');

    // 12. Recommendations
    const listRecs = await request('/recommendations');
    assert(listRecs.status === 200 && Array.isArray(listRecs.body.data), 'GET /api/recommendations returns rule outputs');

    // 13. Bulk Actions
    const bulkStatusRes = await request('/customers/bulk-action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'UPDATE_STATUS',
        customerIds: [createdId],
        payload: {
          status: 'LEAD_MOI',
        },
      }),
    });
    assert(bulkStatusRes.status === 200 && bulkStatusRes.body.data.affected === 1, 'POST /api/customers/bulk-action UPDATE_STATUS works');

    const bulkPriorityRes = await request('/customers/bulk-action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'UPDATE_PRIORITY',
        customerIds: [createdId],
        payload: {
          priority: 'TIN_DUNG',
        },
      }),
    });
    assert(bulkPriorityRes.status === 200 && bulkPriorityRes.body.data.affected === 1, 'POST /api/customers/bulk-action UPDATE_PRIORITY works');

    // 14. Customer Delete
    const deleteCust = await request(`/customers/${createdId}`, { method: 'DELETE' });
    assert(deleteCust.status === 200, 'DELETE /api/customers/:id cascades clean deletion');

    // Clean up test product if created
    await prisma.product.deleteMany({ where: { code: 'API_VERIFY_PROD' } });

    console.log(`\n========================================`);
    console.log(`API Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('API Verification Failed:', error);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => {
        (server as http.Server).close(() => resolve());
      });
    }
  }
}

runApiVerification();
